import { createD1Client } from "../../db";
import { eq, and } from "drizzle-orm";
import * as schema from "../../db/schema";
import { nanoid } from "nanoid";
import type { ContextType } from "../../types";

export const blockingResolvers = {
  Query: {
    async blockedUsers(_: unknown, __: Record<string, never>, context: ContextType) {
      if (!context?.user) {
        throw new Error("Authentication required");
      }

      const blockerId = context.user.id;
      const db = createD1Client(context.env);

      try {
        const blockedRelationships = await db
          .select()
          .from(schema.blockedUser)
          .where(eq(schema.blockedUser.blockerId, blockerId))
          .all();

        const blockedIds = blockedRelationships.map((r) => r.blockedId);

        if (blockedIds.length === 0) {
          return [];
        }

        // Fetch the profiles of blocked users with block dates
        const blockedUsers = await Promise.all(
          blockedIds.map(async (blockedId, index) => {
            if (!blockedId) return null;

            const profile = await db.select().from(schema.profile).where(eq(schema.profile.userId, blockedId)).get();

            if (profile) {
              return {
                ...profile,
                isBlocked: true,
                createdAt: blockedRelationships[index].createdAt, // Use the block date
              };
            }

            return null;
          })
        );

        return blockedUsers.filter(Boolean);
      } catch (error) {
        console.error("Error in blockedUsers resolver:", error);
        return [];
      }
    },

    async isUserBlocked(_: unknown, { userId }: { userId: string }, context: ContextType) {

      if (!context?.user) {
        return false;
      }

      const blockerId = context.user.id;
      const blockedId = userId;

      const db = createD1Client(context.env);
      
      const blockRelationship = await db
        .select()
        .from(schema.blockedUser)
        .where(and(eq(schema.blockedUser.blockerId, blockerId), eq(schema.blockedUser.blockedId, blockedId)))
        .get();

      return !!blockRelationship;
    },
  },

  Mutation: {
    async blockUser(_: unknown, { userId }: { userId: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error("Authentication required");
      }

      const blockerId = context.user.id;
      const blockedId = userId;

      if (blockerId === blockedId) {
        throw new Error("Cannot block yourself");
      }

      const db = createD1Client(context.env);

      const blockedUser = await db.select().from(schema.profile).where(eq(schema.profile.userId, blockedId)).get();

      if (!blockedUser) {
        throw new Error("User to block not found");
      }

      const existingBlock = await db
        .select()
        .from(schema.blockedUser)
        .where(and(eq(schema.blockedUser.blockerId, blockerId), eq(schema.blockedUser.blockedId, blockedId)))
        .get();

      if (existingBlock) {
        return {
          success: true,
          blockedUser,
        };
      }

      const blockId = nanoid();
      const newBlock = {
        id: blockId,
        blockerId,
        blockedId,
        createdAt: new Date().toISOString(),
      };

      await db.insert(schema.blockedUser).values(newBlock);

      // Also unfollow the blocked user if following
      await db
        .delete(schema.relationship)
        .where(and(eq(schema.relationship.followerId, blockerId), eq(schema.relationship.followedId, blockedId)));

      // And remove them from following you
      await db
        .delete(schema.relationship)
        .where(and(eq(schema.relationship.followerId, blockedId), eq(schema.relationship.followedId, blockerId)));

      return {
        success: true,
        blockedUser,
      };
    },

    async unblockUser(_: unknown, { userId }: { userId: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error("Authentication required");
      }

      const blockerId = context.user.id;
      const blockedId = userId;

      const db = createD1Client(context.env);

      await db
        .delete(schema.blockedUser)
        .where(and(eq(schema.blockedUser.blockerId, blockerId), eq(schema.blockedUser.blockedId, blockedId)));

      return {
        success: true,
      };
    },
  },

  Profile: {
    async isBlocked(parent: { userId: string }, _: unknown, context: ContextType) {
      if (!context?.user) return false;

      const blockerId = context.user.id;
      const blockedId = parent.userId;

      if (blockerId === blockedId) return false;

      const db = createD1Client(context.env);

      const blockRelationship = await db
        .select()
        .from(schema.blockedUser)
        .where(and(eq(schema.blockedUser.blockerId, blockerId), eq(schema.blockedUser.blockedId, blockedId)))
        .get();

      return !!blockRelationship;
    },
  },
};
