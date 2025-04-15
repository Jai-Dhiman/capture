import { createD1Client } from "../../db";
import { eq, inArray, like, and } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { ContextType } from "../../types";

export const profileResolvers = {
  Query: {
    async profile(_: unknown, { id }: { id: string }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const db = createD1Client(context.env);
      const profile = await db.select().from(schema.profile).where(eq(schema.profile.userId, id)).get();

      if (!profile) throw new Error("Profile not found");

      const profileWithBooleanFields = {
        ...profile,
        isPrivate: !!profile.isPrivate,
      };

      const currentUserId = context.user.id;
      let isFollowing = null;

      if (currentUserId !== id) {
        const relationship = await db
          .select()
          .from(schema.relationship)
          .where(and(eq(schema.relationship.followerId, currentUserId), eq(schema.relationship.followedId, id)))
          .get();

        isFollowing = !!relationship;

        if (!!profile.isPrivate && !isFollowing) {
          return {
            ...profile,
            isPrivate: true,
            isFollowing,
            posts: [],
          };
        }
      }

      const posts = await db
        .select({
          id: schema.post.id,
          content: schema.post.content,
          createdAt: schema.post.createdAt,
          userId: schema.post.userId,
          type: schema.post.type,
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
        user: {
          id: profile.id,
          userId: profile.userId,
          username: profile.username,
          profileImage: profile.profileImage,
        },
      }));

      return {
        ...profile,
        isPrivate: !!profile.isPrivate,
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

        const currentUserId = context.user.id;
        const followingRelationships = await db
          .select()
          .from(schema.relationship)
          .where(eq(schema.relationship.followerId, currentUserId))
          .all();

        const followingIds = new Set(followingRelationships.map((r) => r.followedId));

        return profiles.map((profile) => ({
          ...profile,
          isPrivate: !!profile.isPrivate,
          isFollowing: followingIds.has(profile.userId),
        }));
      } catch (error) {
        console.error("Error searching users:", error);
        return [];
      }
    },
  },
  Mutation: {
    async updatePrivacySettings(_: unknown, { isPrivate }: { isPrivate: boolean }, context: ContextType) {
      if (!context?.user) {
        throw new Error("Authentication required");
      }

      const userId = context.user.id;
      const db = createD1Client(context.env);

      await db
        .update(schema.profile)
        .set({
          isPrivate: isPrivate ? 1 : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.profile.userId, userId));

      const updatedProfile = await db.select().from(schema.profile).where(eq(schema.profile.userId, userId)).get();

      return {
        ...updatedProfile,
        isPrivate: !!updatedProfile?.isPrivate,
      };
    },
  },
};
