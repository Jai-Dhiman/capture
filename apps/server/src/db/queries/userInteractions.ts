import { eq, and, desc, inArray } from 'drizzle-orm';
import { seenPostLog, blockedUser, relationship } from '../schema';
import { createD1Client } from '../index';
import type { Bindings } from '../../types';

/**
 * Get seen posts for a user from the seen_post_log table
 */
export async function getSeenPostsForUser(userId: string, bindings: Bindings): Promise<string[]> {
  try {
    const db = createD1Client(bindings);

    const seenPosts = await db
      .select({
        postId: seenPostLog.postId,
      })
      .from(seenPostLog)
      .where(eq(seenPostLog.userId, userId))
      .orderBy(desc(seenPostLog.seenAt))
      .limit(1000); // Limit to prevent memory issues

    return seenPosts.map((post) => post.postId);
  } catch (error) {
    console.error('Error fetching seen posts for user:', error);
    throw new Error('Failed to fetch seen posts');
  }
}

/**
 * Get blocked users for a user from the blocked_user table
 */
export async function getBlockedUsersForUser(
  userId: string,
  bindings: Bindings,
): Promise<string[]> {
  try {
    const db = createD1Client(bindings);

    const blockedUsers = await db
      .select({
        blockedId: blockedUser.blockedId,
      })
      .from(blockedUser)
      .where(eq(blockedUser.blockerId, userId))
      .orderBy(desc(blockedUser.createdAt));

    return blockedUsers.map((user) => user.blockedId);
  } catch (error) {
    console.error('Error fetching blocked users for user:', error);
    throw new Error('Failed to fetch blocked users');
  }
}

/**
 * Get users who have blocked the specified user
 */
export async function getUsersWhoBlockedUser(
  userId: string,
  bindings: Bindings,
): Promise<string[]> {
  try {
    const db = createD1Client(bindings);

    const blockingUsers = await db
      .select({
        blockerId: blockedUser.blockerId,
      })
      .from(blockedUser)
      .where(eq(blockedUser.blockedId, userId))
      .orderBy(desc(blockedUser.createdAt));

    return blockingUsers.map((user) => user.blockerId);
  } catch (error) {
    console.error('Error fetching users who blocked user:', error);
    throw new Error('Failed to fetch blocking users');
  }
}

/**
 * Get following relationships for a user
 */
export async function getFollowingForUser(userId: string, bindings: Bindings): Promise<string[]> {
  try {
    const db = createD1Client(bindings);

    const following = await db
      .select({
        followedId: relationship.followedId,
      })
      .from(relationship)
      .where(eq(relationship.followerId, userId))
      .orderBy(desc(relationship.createdAt));

    return following.map((user) => user.followedId);
  } catch (error) {
    console.error('Error fetching following for user:', error);
    throw new Error('Failed to fetch following');
  }
}

/**
 * Get followers for a user
 */
export async function getFollowersForUser(userId: string, bindings: Bindings): Promise<string[]> {
  try {
    const db = createD1Client(bindings);

    const followers = await db
      .select({
        followerId: relationship.followerId,
      })
      .from(relationship)
      .where(eq(relationship.followedId, userId))
      .orderBy(desc(relationship.createdAt));

    return followers.map((user) => user.followerId);
  } catch (error) {
    console.error('Error fetching followers for user:', error);
    throw new Error('Failed to fetch followers');
  }
}

/**
 * Batch get user interactions for multiple users
 */
export async function batchGetUserInteractions(
  userIds: string[],
  bindings: Bindings,
): Promise<{
  [userId: string]: {
    seenPosts: string[];
    blockedUsers: string[];
    following: string[];
    followers: string[];
  };
}> {
  try {
    const db = createD1Client(bindings);

    const [seenPostsResults, blockedUsersResults, followingResults, followersResults] =
      await Promise.all([
        // Get seen posts for all users
        db
          .select({
            userId: seenPostLog.userId,
            postId: seenPostLog.postId,
          })
          .from(seenPostLog)
          .where(inArray(seenPostLog.userId, userIds))
          .orderBy(desc(seenPostLog.seenAt)),

        // Get blocked users for all users
        db
          .select({
            blockerId: blockedUser.blockerId,
            blockedId: blockedUser.blockedId,
          })
          .from(blockedUser)
          .where(inArray(blockedUser.blockerId, userIds))
          .orderBy(desc(blockedUser.createdAt)),

        // Get following relationships for all users
        db
          .select({
            followerId: relationship.followerId,
            followedId: relationship.followedId,
          })
          .from(relationship)
          .where(inArray(relationship.followerId, userIds))
          .orderBy(desc(relationship.createdAt)),

        // Get followers for all users
        db
          .select({
            followerId: relationship.followerId,
            followedId: relationship.followedId,
          })
          .from(relationship)
          .where(inArray(relationship.followedId, userIds))
          .orderBy(desc(relationship.createdAt)),
      ]);

    // Group results by user ID
    const result: { [userId: string]: any } = {};

    // Initialize empty arrays for each user
    for (const userId of userIds) {
      result[userId] = {
        seenPosts: [],
        blockedUsers: [],
        following: [],
        followers: [],
      };
    }

    // Group seen posts by user
    for (const row of seenPostsResults) {
      if (result[row.userId]) {
        result[row.userId].seenPosts.push(row.postId);
      }
    }

    // Group blocked users by blocker
    for (const row of blockedUsersResults) {
      if (result[row.blockerId]) {
        result[row.blockerId].blockedUsers.push(row.blockedId);
      }
    }

    // Group following relationships by follower
    for (const row of followingResults) {
      if (result[row.followerId]) {
        result[row.followerId].following.push(row.followedId);
      }
    }

    // Group followers by followed user
    for (const row of followersResults) {
      if (result[row.followedId]) {
        result[row.followedId].followers.push(row.followerId);
      }
    }

    return result;
  } catch (error) {
    console.error('Error in batch get user interactions:', error);
    throw new Error('Failed to batch get user interactions');
  }
}

/**
 * Add a seen post log entry
 */
export async function addSeenPostLog(
  userId: string,
  postId: string,
  bindings: Bindings,
): Promise<void> {
  try {
    const db = createD1Client(bindings);

    await db
      .insert(seenPostLog)
      .values({
        userId,
        postId,
        seenAt: new Date().toISOString(),
      })
      .onConflictDoNothing(); // Ignore if already exists
  } catch (error) {
    console.error('Error adding seen post log:', error);
    throw new Error('Failed to add seen post log');
  }
}

/**
 * Batch add seen post logs
 */
export async function batchAddSeenPostLogs(
  entries: Array<{ userId: string; postId: string }>,
  bindings: Bindings,
): Promise<void> {
  try {
    const db = createD1Client(bindings);

    const values = entries.map((entry) => ({
      userId: entry.userId,
      postId: entry.postId,
      seenAt: new Date().toISOString(),
    }));

    await db.insert(seenPostLog).values(values).onConflictDoNothing(); // Ignore if already exists
  } catch (error) {
    console.error('Error batch adding seen post logs:', error);
    throw new Error('Failed to batch add seen post logs');
  }
}
