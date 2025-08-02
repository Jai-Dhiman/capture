import { and, eq, sql, inArray, desc, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import {
  createFollowRequestNotification,
  createNewFollowNotification,
} from '../../lib/services/notificationService';
import { createCachingService, CacheKeys, CacheTTL } from '../../lib/cache/cachingService';
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

        // Batch query for all profiles to eliminate N+1 queries
        const profiles = await db
          .select()
          .from(schema.profile)
          .where(inArray(schema.profile.userId, followerIds))
          .all();

        // Create a map for O(1) profile lookups
        const profileMap = new Map(profiles.map(p => [p.userId, p]));

        let followers = followerIds
          .map(followerId => profileMap.get(followerId))
          .filter(Boolean);

        // If user is authenticated, batch check following relationships
        if (context.user?.id && followers.length > 0) {
          const currentUserFollowing = await db
            .select({
              followedId: schema.relationship.followedId
            })
            .from(schema.relationship)
            .where(
              and(
                eq(schema.relationship.followerId, context.user.id),
                inArray(schema.relationship.followedId, followerIds)
              )
            )
            .all();

          const followingSet = new Set(currentUserFollowing.map(r => r.followedId));

          followers = followers.map(profile => ({
            ...profile,
            isFollowing: followingSet.has(profile.userId),
          }));
        }

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

        // Batch query for all profiles to eliminate N+1 queries
        const profiles = await db
          .select()
          .from(schema.profile)
          .where(inArray(schema.profile.userId, followedIds))
          .all();

        // Create following list with isFollowing: true for all since these are confirmed follows
        const following = profiles.map(profile => ({
          ...profile,
          isFollowing: true,
        }));

        return following.filter(Boolean);
      } catch (error) {
        console.error('Error in following resolver:', error);
        return [];
      }
    },

    async followingFeed(
      _: unknown,
      { limit = 10, cursor }: { limit?: number; cursor?: string },
      context: ContextType
    ) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      try {
        const db = createD1Client(context.env);
        const cachingService = createCachingService(context.env);
        const cacheKey = CacheKeys.followingFeed(context.user.id, limit, cursor || 'initial');

        return await cachingService.getOrSet(
          cacheKey,
          async () => {
            // Get user's following relationships
            const following = await db
              .select({ followedId: schema.relationship.followedId })
              .from(schema.relationship)
              .where(eq(schema.relationship.followerId, context.user.id))
              .all();

            if (following.length === 0) {
              return { posts: [], hasMore: false, nextCursor: null };
            }

            const followedIds = following.map(f => f.followedId);

            // Calculate 7-day cutoff
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoIso = sevenDaysAgo.toISOString();

            // Build query conditions
            const conditions = [
              inArray(schema.post.userId, followedIds),
              eq(schema.post.isDraft, 0),
              sql`${schema.post.createdAt} >= ${sevenDaysAgoIso}`, // Only posts from last 7 days
            ];

            // Add cursor-based pagination
            if (cursor) {
              conditions.push(lt(schema.post.createdAt, cursor));
            }

            // Get posts with author information
            const posts = await db
              .select({
                id: schema.post.id,
                userId: schema.post.userId,
                content: schema.post.content,
                type: schema.post.type,
                isDraft: schema.post.isDraft,
                version: schema.post.version,
                createdAt: schema.post.createdAt,
                updatedAt: schema.post.updatedAt,
                _saveCount: schema.post._saveCount,
                _commentCount: schema.post._commentCount,
                authorUsername: schema.profile.username,
                authorIsPrivate: schema.profile.isPrivate,
                authorVerifiedType: schema.profile.verifiedType,
                authorProfileImage: schema.profile.profileImage,
                authorBio: schema.profile.bio,
              })
              .from(schema.post)
              .innerJoin(schema.profile, eq(schema.post.userId, schema.profile.userId))
              .where(and(...conditions))
              .orderBy(desc(schema.post.createdAt))
              .limit(limit + 1)
              .all();

            // Apply privacy filtering
            const filteredPosts = [];
            for (const post of posts) {
              // Check if user is blocked
              const isBlocked = await db
                .select()
                .from(schema.blockedUser)
                .where(
                  and(
                    sql`(${schema.blockedUser.blockerId} = ${context.user.id} AND ${schema.blockedUser.blockedId} = ${post.userId}) OR (${schema.blockedUser.blockerId} = ${post.userId} AND ${schema.blockedUser.blockedId} = ${context.user.id})`
                  )
                )
                .get();

              if (isBlocked) continue;

              // Since we're querying posts from followed users, privacy is already handled
              // (we can see posts from users we follow, respecting their privacy settings)
              filteredPosts.push(post);
            }

            // Determine pagination
            const hasMore = filteredPosts.length > limit;
            const resultPosts = hasMore ? filteredPosts.slice(0, limit) : filteredPosts;
            const nextCursor = hasMore ? resultPosts[resultPosts.length - 1].createdAt : null;

            // Transform to full Post objects
            const transformedPosts = resultPosts.map(post => ({
              id: post.id,
              userId: post.userId,
              content: post.content,
              type: post.type,
              isDraft: post.isDraft === 1,
              version: post.version,
              createdAt: post.createdAt,
              updatedAt: post.updatedAt,
              _commentCount: post._commentCount,
              _saveCount: post._saveCount,
              user: {
                id: post.userId,
                userId: post.userId,
                username: post.authorUsername,
                isPrivate: post.authorIsPrivate === 1,
                verifiedType: post.authorVerifiedType || 'none',
                profileImage: post.authorProfileImage,
                bio: post.authorBio,
              },
            }));

            return {
              posts: transformedPosts,
              hasMore,
              nextCursor,
            };
          },
          CacheTTL.SHORT // 2 minutes cache for frequently changing feed
        );
      } catch (error) {
        console.error('Error in followingFeed resolver:', error);
        throw new Error('Failed to fetch following feed');
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
