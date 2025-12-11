import { and, desc, eq, sql, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import type { ContextType } from '../../types';
import { createLikeNotification } from '../../lib/services/notificationService';

export const likeResolvers = {
  Query: {
    async likedPosts(_: unknown, { limit = 10, offset = 0 }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const likedPostIds = await db
          .select({ postId: schema.postLike.postId })
          .from(schema.postLike)
          .where(eq(schema.postLike.userId, context.user.id))
          .limit(limit)
          .offset(offset)
          .orderBy(() => [desc(schema.postLike.createdAt)])
          .all();

        if (!likedPostIds.length) {
          return [];
        }

        const postIds = likedPostIds.map(({ postId }) => postId).filter(Boolean);

        if (postIds.length === 0) {
          return [];
        }

        const [posts, profiles, media] = await Promise.all([
          db.select()
            .from(schema.post)
            .where(inArray(schema.post.id, postIds))
            .all(),

          db.select({
            userId: schema.profile.userId,
            id: schema.profile.id,
            username: schema.profile.username,
            profileImage: schema.profile.profileImage,
            bio: schema.profile.bio,
            verifiedType: schema.profile.verifiedType,
            isPrivate: schema.profile.isPrivate,
            createdAt: schema.profile.createdAt,
            updatedAt: schema.profile.updatedAt,
            postUserId: schema.post.userId
          })
            .from(schema.profile)
            .innerJoin(schema.post, eq(schema.profile.userId, schema.post.userId))
            .where(inArray(schema.post.id, postIds))
            .all(),

          db.select()
            .from(schema.media)
            .where(inArray(schema.media.postId, postIds))
            .all()
        ]);

        const postMap = new Map(posts.map(p => [p.id, p]));
        const userMap = new Map(profiles.map(p => [p.postUserId, p]));
        const mediaMap = new Map<string, typeof media>();

        media.forEach(m => {
          if (!mediaMap.has(m.postId!)) {
            mediaMap.set(m.postId!, []);
          }
          mediaMap.get(m.postId!)!.push(m);
        });

        const likedPosts = likedPostIds
          .map(({ postId }) => {
            const post = postMap.get(postId);
            if (!post) return null;

            const user = userMap.get(post.userId);
            const postMedia = mediaMap.get(post.id) || [];

            return {
              ...post,
              user,
              media: postMedia,
              comments: [],
              hashtags: [],
              savedBy: [],
            };
          })
          .filter(Boolean);

        return likedPosts;
      } catch (error) {
        console.error('Error fetching liked posts:', error);
        throw new Error(
          `Failed to fetch liked posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },

  Mutation: {
    async likePost(_: unknown, { postId }: { postId: string }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get();

        if (!post) {
          throw new Error('Post not found');
        }

        const existingLike = await db
          .select()
          .from(schema.postLike)
          .where(
            and(eq(schema.postLike.userId, context.user.id), eq(schema.postLike.postId, postId)),
          )
          .get();

        if (existingLike) {
          return { success: true, post };
        }

        await db.insert(schema.postLike).values({
          id: nanoid(),
          userId: context.user.id,
          postId,
          createdAt: new Date().toISOString(),
        });

        await db
          .update(schema.post)
          .set({ _likeCount: sql`${schema.post._likeCount} + 1` })
          .where(eq(schema.post.id, postId));

        await db.insert(schema.userActivity).values({
          id: nanoid(),
          userId: context.user.id,
          eventType: 'like',
          createdAt: new Date().toISOString(),
        });

        try {
          await context.env.USER_VECTOR_QUEUE.send({ userId: context.user.id });
        } catch (queueError) {
          console.error(
            `[likePost] FAILED to send userId ${context.user.id} to USER_VECTOR_QUEUE:`,
            queueError,
          );
        }

        // Create notification for post author
        if (post.userId !== context.user.id) {
          const actionUserProfile = await db
            .select({ username: schema.profile.username })
            .from(schema.profile)
            .where(eq(schema.profile.userId, context.user.id))
            .get();

          if (actionUserProfile?.username) {
            await createLikeNotification({
              postAuthorId: post.userId,
              actionUserId: context.user.id,
              actionUsername: actionUserProfile.username,
              postId,
              env: context.env,
            });
          }
        }

        return { success: true, post };
      } catch (error) {
        console.error('Error liking post:', error);
        throw new Error(
          `Failed to like post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async unlikePost(_: unknown, { postId }: { postId: string }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        await db
          .delete(schema.postLike)
          .where(
            and(eq(schema.postLike.userId, context.user.id), eq(schema.postLike.postId, postId)),
          );

        await db
          .update(schema.post)
          .set({ _likeCount: sql`CASE WHEN ${schema.post._likeCount} > 0 THEN ${schema.post._likeCount} - 1 ELSE 0 END` })
          .where(eq(schema.post.id, postId));

        try {
          await context.env.USER_VECTOR_QUEUE.send({ userId: context.user.id });
        } catch (queueError) {
          console.error(
            `[unlikePost] FAILED to send userId ${context.user.id} to USER_VECTOR_QUEUE:`,
            queueError,
          );
        }

        return { success: true };
      } catch (error) {
        console.error('Error unliking post:', error);
        throw new Error(
          `Failed to unlike post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },

  Post: {
    async isLiked(parent: { id: string }, _: unknown, context: ContextType) {
      if (!context.user || !parent.id) return false;

      const db = createD1Client(context.env);

      try {
        const likedPost = await db
          .select()
          .from(schema.postLike)
          .where(
            and(
              eq(schema.postLike.userId, context.user.id),
              eq(schema.postLike.postId, parent.id),
            ),
          )
          .get();

        return !!likedPost;
      } catch (error) {
        console.error('Error checking if post is liked:', error);
        return false;
      }
    },
  },
};
