import { createD1Client } from "../../db";
import { eq, inArray, like, and } from "drizzle-orm";
import * as schema from "../../db/schema";

export const profileResolvers = {
  Query: {
    async profile(_: unknown, { id }: { id: string }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const db = createD1Client(context.env);

      const profile = await db.select().from(schema.profile).where(eq(schema.profile.userId, id)).get();

      if (!profile) throw new Error("Profile not found");

      const currentUserId = context.user.id;
      let isFollowing = null;

      if (currentUserId !== id) {
        const relationship = await db
          .select()
          .from(schema.relationship)
          .where(and(eq(schema.relationship.followerId, currentUserId), eq(schema.relationship.followedId, id)))
          .get();

        isFollowing = !!relationship;
      }

      const posts = await db
        .select({
          id: schema.post.id,
          content: schema.post.content,
          createdAt: schema.post.createdAt,
          userId: schema.post.userId,
        })
        .from(schema.post)
        .where(eq(schema.post.userId, id))
        .all();

      const mediaItems =
        posts.length > 0
          ? await db
              .select({
                id: schema.media.id,
                postId: schema.media.postId,
                storageKey: schema.media.storageKey,
                type: schema.media.type,
                order: schema.media.order,
              })
              .from(schema.media)
              .where(
                inArray(
                  schema.media.postId,
                  posts.map((post) => post.id)
                )
              )
              .all()
          : [];

      const postsWithMedia = posts.map((post) => ({
        ...post,
        media: mediaItems.filter((media) => media.postId === post.id),
      }));

      return {
        ...profile,
        isFollowing,
        posts: postsWithMedia,
      };
    },

    async searchUsers(_: unknown, { query }: { query: string }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      if (!query || query.trim() === "") {
        return [];
      }

      const db = createD1Client(context.env);

      try {
        const likeQuery = `%${query}%`;

        const profiles = await db
          .select()
          .from(schema.profile)
          .where(like(schema.profile.username, likeQuery))
          .limit(10)
          .all();

        console.log(`Found ${profiles.length} profiles for query "${query}"`);

        const currentUserId = context.user.id;
        const followingRelationships = await db
          .select()
          .from(schema.relationship)
          .where(eq(schema.relationship.followerId, currentUserId))
          .all();

        const followingIds = new Set(followingRelationships.map((r) => r.followedId));

        return profiles.map((profile) => ({
          ...profile,
          isFollowing: followingIds.has(profile.userId),
        }));
      } catch (error) {
        console.error("Error searching users:", error);
        return [];
      }
    },
  },
};
