import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import {
  createFollowRequestNotification,
  createNewFollowNotification,
} from '../../lib/services/notificationService';
import type { ContextType } from '../../types';

export const relationshipResolvers = {
  Query: {
    async followers(_: unknown, { userId }: { userId: string }, context: ContextType) {
      if (!userId) {
        return [];
      }

      try {
        const db = createD1Client(context.env);

        const relationships = await db
          .select()
          .from(schema.relationship)
          .where(eq(schema.relationship.followedId, userId))
          .all();

        const followerIds = relationships.map((r) => r.followerId);

        if (followerIds.length === 0) {
          return [];
        }

        const followers = await Promise.all(
          followerIds.map(async (followerId) => {
            if (!followerId) return null;

            const profile = await db
              .select()
              .from(schema.profile)
              .where(eq(schema.profile.userId, followerId))
              .get();

            if (profile) {
              if (context.user?.id) {
                const isFollowing = await db
                  .select()
                  .from(schema.relationship)
                  .where(
                    and(
                      eq(schema.relationship.followerId, context.user.id),
                      eq(schema.relationship.followedId, followerId),
                    ),
                  )
                  .get();

                return {
                  ...profile,
                  isFollowing: !!isFollowing,
                };
              }
              return profile;
            }

            return null;
          }),
        );

        return followers.filter(Boolean);
      } catch (error) {
        console.error('Error in followers resolver:', error);
        return [];
      }
    },

    async following(_: unknown, { userId }: { userId: string }, context: ContextType) {
      if (!userId) {
        return [];
      }

      try {
        const db = createD1Client(context.env);

        const relationships = await db
          .select()
          .from(schema.relationship)
          .where(eq(schema.relationship.followerId, userId))
          .all();

        const followedIds = relationships.map((r) => r.followedId);

        if (followedIds.length === 0) {
          return [];
        }

        const following = await Promise.all(
          followedIds.map(async (followedId) => {
            if (!followedId) return null;

            const profile = await db
              .select()
              .from(schema.profile)
              .where(eq(schema.profile.userId, followedId))
              .get();

            if (profile) {
              return {
                ...profile,
                isFollowing: true,
              };
            }

            return null;
          }),
        );

        return following.filter(Boolean);
      } catch (error) {
        console.error('Error in following resolver:', error);
        return [];
      }
    },
  },

  Mutation: {
    async followUser(_: unknown, { userId }: { userId: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const followerId = context.user.id;
      const followedId = userId;

      if (followerId === followedId) {
        throw new Error('Cannot follow yourself');
      }

      const db = createD1Client(context.env);

      const followedUser = await db
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, followedId))
        .get();

      if (!followedUser) {
        throw new Error('User to follow not found');
      }

      const existingRelationship = await db
        .select()
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.followerId, followerId),
            eq(schema.relationship.followedId, followedId),
          ),
        )
        .get();

      if (existingRelationship) {
        return {
          success: true,
          relationship: existingRelationship,
        };
      }

      const relationshipId = nanoid();
      const newRelationship = {
        id: relationshipId,
        followerId,
        followedId,
        createdAt: new Date().toISOString(),
      };

      await db.insert(schema.relationship).values(newRelationship);

      // Get the current user's username for the notification
      const follower = await db
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, followerId))
        .get();

      if (follower) {
        // Create appropriate notification based on profile privacy
        if (followedUser.isPrivate) {
          await createFollowRequestNotification({
            targetUserId: followedId,
            actionUserId: followerId,
            actionUsername: follower.username,
            env: context.env,
          });
        } else {
          await createNewFollowNotification({
            targetUserId: followedId,
            actionUserId: followerId,
            actionUsername: follower.username,
            env: context.env,
          });
        }
      }

      return {
        success: true,
        relationship: newRelationship,
      };
    },

    async unfollowUser(_: unknown, { userId }: { userId: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const followerId = context.user.id;
      const followedId = userId;

      const db = createD1Client(context.env);

      await db
        .delete(schema.relationship)
        .where(
          and(
            eq(schema.relationship.followerId, followerId),
            eq(schema.relationship.followedId, followedId),
          ),
        );

      return {
        success: true,
      };
    },
  },

  Profile: {
    async isFollowing(parent: { userId: string }, _: unknown, context: ContextType) {
      if (!context?.user) return false;

      const followerId = context.user.id;
      const followedId = parent.userId;

      if (followerId === followedId) return null;

      const db = createD1Client(context.env);

      const relationship = await db
        .select()
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.followerId, followerId),
            eq(schema.relationship.followedId, followedId),
          ),
        )
        .get();

      return !!relationship;
    },

    async followersCount(parent: { userId: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env);

      const result = await db
        .select({ count: sql`count(*)` })
        .from(schema.relationship)
        .where(eq(schema.relationship.followedId, parent.userId))
        .get();

      return result?.count || 0;
    },

    async followingCount(parent: { userId: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env);

      const result = await db
        .select({ count: sql`count(*)` })
        .from(schema.relationship)
        .where(eq(schema.relationship.followerId, parent.userId))
        .get();

      return result?.count || 0;
    },
  },
};
