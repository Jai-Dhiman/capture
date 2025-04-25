import { createD1Client } from '../../db';
import { eq, inArray, sql, and } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { nanoid } from 'nanoid';
import type { ContextType } from '../../types';

export const postResolvers = {
  Query: {
    async feed(
      _: unknown,
      { limit = 10, cursor }: { limit?: number; cursor?: string },
      context: { env: any; user: any },
    ): Promise<{ posts: any[]; nextCursor?: string | null }> {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      const relationships = await db
        .select({ followedId: schema.relationship.followedId })
        .from(schema.relationship)
        .where(eq(schema.relationship.followerId, context.user.id))
        .all();

      const followedUserIds = relationships.map((r) => r.followedId);

      if (followedUserIds.length === 0) {
        return { posts: [], nextCursor: null };
      }

      let query = db
        .select()
        .from(schema.post)
        .where(inArray(schema.post.userId, followedUserIds))
        .orderBy(sql`${schema.post.createdAt} DESC`)
        .limit(limit + 1);

      if (cursor) {
        const cursorRow = await db
          .select({ createdAt: schema.post.createdAt })
          .from(schema.post)
          .where(eq(schema.post.id, cursor))
          .get();

        if (cursorRow) {
          query = query.where(sql`${schema.post.createdAt} < ${cursorRow.createdAt}`);
        }
      }

      const rows = await query.all();
      const hasNextPage = rows.length > limit;
      const sliced = hasNextPage ? rows.slice(0, limit) : rows;
      const nextCursor = hasNextPage ? sliced[sliced.length - 1].id : null;

      const enhancedPosts = await Promise.all(
        sliced.map(async (post) => {
          const user = await db
            .select()
            .from(schema.profile)
            .where(eq(schema.profile.userId, post.userId))
            .get();

          const media = await db
            .select()
            .from(schema.media)
            .where(eq(schema.media.postId, post.id))
            .all();

          const postHashtags = await db
            .select()
            .from(schema.postHashtag)
            .where(eq(schema.postHashtag.postId, post.id))
            .all();

          let hashtags: Array<{ id: string; name: string }> = [];
          if (postHashtags.length > 0) {
            const hashtagIds = postHashtags.map((ph) => ph.hashtagId).filter(Boolean);
            if (hashtagIds.length > 0) {
              hashtags = await db
                .select()
                .from(schema.hashtag)
                .where(inArray(schema.hashtag.id, hashtagIds))
                .all();
            }
          }

          // const comments = await db
          //   .select()
          //   .from(schema.comment)
          //   .where(eq(schema.comment.postId, post.id))
          //   .all();

          const saved = await db
            .select()
            .from(schema.savedPost)
            .where(
              and(
                eq(schema.savedPost.postId, post.id),
                eq(schema.savedPost.userId, context.user.id),
              ),
            )
            .get();

          return {
            ...post,
            user,
            media,
            hashtags,
            comments: [],
            isSaved: !!saved,
          };
        }),
      );

      return { posts: enhancedPosts, nextCursor };
    },

    async post(_parent: unknown, { id }: { id: string }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      try {
        const db = createD1Client(context.env);
        const post = await db.select().from(schema.post).where(eq(schema.post.id, id)).get();

        if (!post) throw new Error('Post not found');

        const user = await db
          .select()
          .from(schema.profile)
          .where(post.userId ? eq(schema.profile.userId, post.userId) : sql`FALSE`)
          .get();

        const media = await db
          .select()
          .from(schema.media)
          .where(eq(schema.media.postId, post.id))
          .all();

        const postHashtags = await db
          .select()
          .from(schema.postHashtag)
          .where(eq(schema.postHashtag.postId, post.id))
          .all();

        let hashtags: Array<{ id: string; name: string }> = [];
        if (postHashtags.length > 0) {
          const hashtagIds = postHashtags.map((ph) => ph.hashtagId);
          const validHashtagIds = hashtagIds.filter((id): id is string => id !== null);
          hashtags = await db
            .select()
            .from(schema.hashtag)
            .where(
              validHashtagIds.length > 0 ? inArray(schema.hashtag.id, validHashtagIds) : sql`FALSE`,
            )
            .all();
        }

        const comments = await db
          .select()
          .from(schema.comment)
          .where(eq(schema.comment.postId, post.id))
          .all();

        return {
          ...post,
          user,
          media,
          hashtags,
          comments,
          savedBy: [],
        };
      } catch (error) {
        console.error('Error fetching post:', error);
        throw new Error(
          `Failed to fetch post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },

  Mutation: {
    async createPost(_parent: unknown, { input }: { input: any }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const existingProfile = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get();

        if (!existingProfile) {
          throw new Error('Profile not found.');
        }

        const postId = nanoid();

        await db.insert(schema.post).values({
          id: postId,
          userId: context.user.id,
          content: input.content,
          type: input.type || 'post',
          createdAt: new Date().toISOString(),
        });

        try {
          await context.env.POST_QUEUE.send({ postId });
        } catch (queueError) {
          console.error(`[createPost] FAILED to send postId ${postId} to POST_QUEUE:`, queueError);
        }

        if (input.mediaIds?.length) {
          await Promise.all(
            input.mediaIds.map((mediaId: string, index: number) =>
              db
                .update(schema.media)
                .set({
                  postId,
                  order: index,
                })
                .where(eq(schema.media.id, mediaId)),
            ),
          );
        }

        if (input.hashtagIds?.length) {
          await Promise.all(
            input.hashtagIds.map((hashtagId: string) =>
              db.insert(schema.postHashtag).values({
                postId,
                hashtagId,
                createdAt: new Date().toISOString(),
              }),
            ),
          );
        }

        const createdPost = await db
          .select({
            id: schema.post.id,
            content: schema.post.content,
            type: schema.post.type,
            createdAt: schema.post.createdAt,
            userId: schema.post.userId,
          })
          .from(schema.post)
          .where(eq(schema.post.id, postId))
          .get();

        if (!createdPost) throw new Error('Failed to create post');

        const userProfile = await db
          .select({
            id: schema.profile.id,
            userId: schema.profile.userId,
            username: schema.profile.username,
            image: schema.profile.profileImage,
          })
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get();

        if (!userProfile) throw new Error('User profile not found');

        const mediaItems: Array<any> = [];
        const hashtagItems: Array<any> = [];

        return {
          ...createdPost,
          type: createdPost.type || 'post',
          user: userProfile,
          media: mediaItems,
          comments: [],
          hashtags: hashtagItems,
          savedBy: [],
        };
      } catch (error) {
        console.error('Creation error:', error);
        console.error('Input:', input);
        throw new Error(
          `Failed to create post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async deletePost(_parent: unknown, { id }: { id: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const post = await db.select().from(schema.post).where(eq(schema.post.id, id)).get();

        if (!post) {
          throw new Error('Post not found');
        }

        if (post.userId !== context.user.id) {
          throw new Error('Not authorized to delete this post');
        }

        await db.delete(schema.postHashtag).where(eq(schema.postHashtag.postId, id));

        const mediaItems = await db
          .select()
          .from(schema.media)
          .where(eq(schema.media.postId, id))
          .all();

        await db.delete(schema.comment).where(eq(schema.comment.postId, id));
        await db.delete(schema.savedPost).where(eq(schema.savedPost.postId, id));
        if (mediaItems.length > 0) {
          await db.delete(schema.media).where(eq(schema.media.postId, id));

          // Add here: Delete the actual files from Cloudflare
        }

        await db.delete(schema.post).where(eq(schema.post.id, id));

        return {
          id,
          success: true,
        };
      } catch (error) {
        console.error('Delete post error:', error);
        throw new Error(
          `Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },

  Post: {
    async hashtags(parent: { id: string }, _: unknown, context: ContextType) {
      try {
        if (!parent.id) return [];

        const db = createD1Client(context.env);

        const postHashtags = await db
          .select({ hashtagId: schema.postHashtag.hashtagId })
          .from(schema.postHashtag)
          .where(eq(schema.postHashtag.postId, parent.id))
          .all();

        if (!postHashtags || postHashtags.length === 0) return [];

        const hashtagIds = postHashtags.map((ph) => ph.hashtagId).filter(Boolean);
        const validHashtagIds = hashtagIds.filter((id): id is string => id !== null);

        if (hashtagIds.length === 0) return [];

        const hashtags: Array<{ id: string; name: string }> = await db
          .select()
          .from(schema.hashtag)
          .where(
            validHashtagIds.length > 0 ? inArray(schema.hashtag.id, validHashtagIds) : sql`FALSE`,
          )
          .all();

        return hashtags || [];
      } catch (error) {
        console.error('Error resolving hashtags:', error);
        return [];
      }
    },

    _commentCount: (parent: { _commentCount: number }) => parent._commentCount,
    _saveCount: (parent: { _saveCount: number }) => parent._saveCount,
  },
};
