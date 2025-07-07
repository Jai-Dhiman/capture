import { and, desc, eq, sql, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import type { ContextType } from '../../types';

export const savedPostResolvers = {
  Query: {
    async savedPosts(_: unknown, { limit = 10, offset = 0 }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const savedPostsIds = await db
          .select({ postId: schema.savedPost.postId })
          .from(schema.savedPost)
          .where(eq(schema.savedPost.userId, context.user.id))
          .limit(limit)
          .offset(offset)
          .orderBy(() => [desc(schema.savedPost.createdAt)])
          .all();

        if (!savedPostsIds.length) {
          return [];
        }

        // Extract post IDs for batch queries
        const postIds = savedPostsIds.map(({ postId }) => postId).filter(Boolean);

        if (postIds.length === 0) {
          return [];
        }

        // Batch query for posts, users, and media to eliminate N+1 queries
        const [posts, profiles, media] = await Promise.all([
          // Get all posts in one query
          db.select()
            .from(schema.post)
            .where(inArray(schema.post.id, postIds))
            .all(),
          
          // Get all users in one query by joining with posts
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
          
          // Get all media in one query
          db.select()
            .from(schema.media)
            .where(inArray(schema.media.postId, postIds))
            .all()
        ]);

        // Create lookup maps for O(1) access
        const postMap = new Map(posts.map(p => [p.id, p]));
        const userMap = new Map(profiles.map(p => [p.postUserId, p]));
        const mediaMap = new Map<string, typeof media>();
        
        // Group media by post ID
        media.forEach(m => {
          if (!mediaMap.has(m.postId!)) {
            mediaMap.set(m.postId!, []);
          }
          mediaMap.get(m.postId!)!.push(m);
        });

        // Build final result maintaining order of saved posts
        const savedPosts = savedPostsIds
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

        return savedPosts.filter(Boolean);
      } catch (error) {
        console.error('Error fetching saved posts:', error);
        throw new Error(
          `Failed to fetch saved posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },

  Mutation: {
    async savePost(_: unknown, { postId }: { postId: string }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get();

        if (!post) {
          throw new Error('Post not found');
        }

        const existingSave = await db
          .select()
          .from(schema.savedPost)
          .where(
            and(eq(schema.savedPost.userId, context.user.id), eq(schema.savedPost.postId, postId)),
          )
          .get();

        if (existingSave) {
          return { success: true, post };
        }

        await db.insert(schema.savedPost).values({
          id: nanoid(),
          userId: context.user.id,
          postId,
          createdAt: new Date().toISOString(),
        });

        await db
          .update(schema.post)
          .set({ _saveCount: sql`${schema.post._saveCount} + 1` })
          .where(eq(schema.post.id, postId));

        // record save event
        await db.insert(schema.userActivity).values({
          id: nanoid(),
          userId: context.user.id,
          eventType: 'save',
          createdAt: new Date().toISOString(),
        });

        try {
          await context.env.USER_VECTOR_QUEUE.send({ userId: context.user.id });
        } catch (queueError) {
          console.error(
            `[savePost] FAILED to send userId ${context.user.id} to USER_VECTOR_QUEUE:`,
            queueError,
          );
        }

        return { success: true, post };
      } catch (error) {
        console.error('Error saving post:', error);
        throw new Error(
          `Failed to save post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async unsavePost(_: unknown, { postId }: { postId: string }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        await db
          .delete(schema.savedPost)
          .where(
            and(eq(schema.savedPost.userId, context.user.id), eq(schema.savedPost.postId, postId)),
          );

        // Decrement post's save count
        await db
          .update(schema.post)
          .set({ _saveCount: sql`${schema.post._saveCount} - 1` })
          .where(eq(schema.post.id, postId));

        try {
          await context.env.USER_VECTOR_QUEUE.send({ userId: context.user.id });
        } catch (queueError) {
          console.error(
            `[unsavePost] FAILED to send userId ${context.user.id} to USER_VECTOR_QUEUE:`,
            queueError,
          );
        }

        return { success: true };
      } catch (error) {
        console.error('Error unsaving post:', error);
        throw new Error(
          `Failed to unsave post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },

  Post: {
    async isSaved(parent: { id: string }, _: unknown, context: ContextType) {
      if (!context.user || !parent.id) return false;

      const db = createD1Client(context.env);

      try {
        const savedPost = await db
          .select()
          .from(schema.savedPost)
          .where(
            and(
              eq(schema.savedPost.userId, context.user.id),
              eq(schema.savedPost.postId, parent.id),
            ),
          )
          .get();

        return !!savedPost;
      } catch (error) {
        console.error('Error checking if post is saved:', error);
        return false;
      }
    },
  },
};
