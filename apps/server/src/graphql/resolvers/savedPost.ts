import { and, desc, eq, sql } from 'drizzle-orm';
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

        const savedPosts = await Promise.all(
          savedPostsIds.map(async ({ postId }) => {
            if (!postId) {
              return null;
            }

            const post = await db
              .select()
              .from(schema.post)
              .where(eq(schema.post.id, postId))
              .get();

            if (!post) return null;

            const user = await db
              .select()
              .from(schema.profile)
              .where(post.userId !== null ? eq(schema.profile.userId, post.userId) : sql`FALSE`)
              .get();

            const media = await db
              .select()
              .from(schema.media)
              .where(eq(schema.media.postId, post.id))
              .all();

            return {
              ...post,
              user,
              media,
              comments: [],
              hashtags: [],
              savedBy: [],
            };
          }),
        );

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
