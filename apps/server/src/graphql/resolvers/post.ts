import { createD1Client } from "../../db";
import { eq, inArray, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { nanoid } from "nanoid";
import type { ContextType } from "../../types";

export const postResolvers = {
  Query: {
    async feed(_: unknown, { limit = 10, offset = 0 }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const db = createD1Client(context.env);
      const posts = await db.query.post.findMany({
        limit,
        offset,
        orderBy: (posts, { desc }) => [desc(posts.createdAt)],
        with: {
          user: true,
          media: true,
          comments: true,
          hashtags: true,
          savedBy: true,
        },
      });
      return posts;
    },

    async post(_parent: unknown, { id }: { id: string }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      try {
        const db = createD1Client(context.env);
        const post = await db.select().from(schema.post).where(eq(schema.post.id, id)).get();

        if (!post) throw new Error("Post not found");

        const user = await db
          .select()
          .from(schema.profile)
          .where(post.userId ? eq(schema.profile.userId, post.userId) : sql`FALSE`)
          .get();

        const media = await db.select().from(schema.media).where(eq(schema.media.postId, post.id)).all();

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
            .where(validHashtagIds.length > 0 ? inArray(schema.hashtag.id, validHashtagIds) : sql`FALSE`)
            .all();
        }

        const comments = await db.select().from(schema.comment).where(eq(schema.comment.postId, post.id)).all();

        return {
          ...post,
          user,
          media,
          hashtags,
          comments,
          savedBy: [],
        };
      } catch (error) {
        console.error("Error fetching post:", error);
        throw new Error(`Failed to fetch post: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
  },

  Mutation: {
    async createPost(_parent: unknown, { input }: { input: any }, context: ContextType) {
      if (!context?.user) {
        throw new Error("Authentication required");
      }

      const db = createD1Client(context.env);

      try {
        const existingProfile = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get();

        if (!existingProfile) {
          throw new Error("Profile not found.");
        }

        const postId = nanoid();

        await db.insert(schema.post).values({
          id: postId,
          userId: context.user.id,
          content: input.content,
          type: input.type || "post",
          createdAt: new Date().toISOString(),
        });

        if (input.mediaIds?.length) {
          await Promise.all(
            input.mediaIds.map((mediaId: string, index: number) =>
              db
                .update(schema.media)
                .set({
                  postId,
                  order: index,
                })
                .where(eq(schema.media.id, mediaId))
            )
          );
        }

        if (input.hashtagIds?.length) {
          await Promise.all(
            input.hashtagIds.map((hashtagId: string) =>
              db.insert(schema.postHashtag).values({
                postId,
                hashtagId,
                createdAt: new Date().toISOString(),
              })
            )
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

        if (!createdPost) throw new Error("Failed to create post");

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

        if (!userProfile) throw new Error("User profile not found");

        let mediaItems: Array<any> = [];
        let hashtagItems: Array<any> = [];

        return {
          ...createdPost,
          type: createdPost.type || "post",
          user: userProfile,
          media: mediaItems,
          comments: [],
          hashtags: hashtagItems,
          savedBy: [],
        };
      } catch (error) {
        console.error("Creation error:", error);
        console.error("Input:", input);
        throw new Error(`Failed to create post: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },

    async deletePost(_parent: unknown, { id }: { id: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error("Authentication required");
      }

      const db = createD1Client(context.env);

      try {
        const post = await db.select().from(schema.post).where(eq(schema.post.id, id)).get();

        if (!post) {
          throw new Error("Post not found");
        }

        if (post.userId !== context.user.id) {
          throw new Error("Not authorized to delete this post");
        }

        await db.delete(schema.postHashtag).where(eq(schema.postHashtag.postId, id));

        const mediaItems = await db.select().from(schema.media).where(eq(schema.media.postId, id)).all();

        await db.delete(schema.comment).where(eq(schema.comment.postId, id));
        await db.delete(schema.savedPost).where(eq(schema.savedPost.postId, id));
        if (mediaItems.length > 0) {
          await db.delete(schema.media).where(eq(schema.media.postId, id));

          // Add hereL Delete the actual files from Cloudflare
        }

        await db.delete(schema.post).where(eq(schema.post.id, id));

        return {
          id,
          success: true,
        };
      } catch (error) {
        console.error("Delete post error:", error);
        throw new Error(`Failed to delete post: ${error instanceof Error ? error.message : "Unknown error"}`);
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

        const hashtags = await db
          .select()
          .from(schema.hashtag)
          .where(validHashtagIds.length > 0 ? inArray(schema.hashtag.id, validHashtagIds) : sql`FALSE`)
          .all();

        return hashtags || [];
      } catch (error) {
        console.error("Error resolving hashtags:", error);
        return [];
      }
    },

    _commentCount: async (parent: { id: string }, _: unknown, context: ContextType) => {
      const db = createD1Client(context.env);

      const result = await db
        .select({ count: sql`count(*)` })
        .from(schema.comment)
        .where(eq(schema.comment.postId, parent.id))
        .get();

      return result?.count || 0;
    },
  },
};
