import { eq, and, or, inArray, sql, desc, asc } from 'drizzle-orm';
import { post, profile, relationship, blockedUser } from '../schema';
import { createD1Client } from '../index';
import type { Bindings } from '../../types';

interface PostWithPrivacy {
  id: string;
  userId: string;
  content: string;
  type: string;
  isDraft: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  _saveCount: number;
  _commentCount: number;
  authorUsername: string;
  authorIsPrivate: number;
  authorVerifiedType: string;
  authorProfileImage: string | null;
  authorBio: string | null;
}

interface FilterOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'newest' | 'oldest' | 'popular';
  includeOwnPosts?: boolean;
  contentTypes?: string[];
}

/**
 * Filter posts based on privacy settings and following status
 * Returns posts that the user is allowed to see based on:
 * 1. Public posts from non-blocked users
 * 2. Private posts from users the current user follows
 * 3. User's own posts (if includeOwnPosts is true)
 */
export async function filterPostsByPrivacyAndFollowing(
  posts: Array<{ id: string; userId: string }>,
  currentUserId: string,
  bindings: Bindings,
  options: FilterOptions = {},
): Promise<PostWithPrivacy[]> {
  if (posts.length === 0) return [];

  try {
    const db = createD1Client(bindings);
    const postIds = posts.map((p) => p.id);

    // Build the query with proper joins
    let query = db
      .select({
        id: post.id,
        userId: post.userId,
        content: post.content,
        type: post.type,
        isDraft: post.isDraft,
        version: post.version,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        _saveCount: post._saveCount,
        _commentCount: post._commentCount,
        authorUsername: profile.username,
        authorIsPrivate: profile.isPrivate,
        authorVerifiedType: profile.verifiedType,
        authorProfileImage: profile.profileImage,
        authorBio: profile.bio,
      })
      .from(post)
      .innerJoin(profile, eq(post.userId, profile.userId))
      .where(
        and(
          inArray(post.id, postIds),
          eq(post.isDraft, 0), // Only published posts
          // Privacy filtering logic
          or(
            // Public posts
            eq(profile.isPrivate, 0),
            // Private posts from followed users
            and(
              eq(profile.isPrivate, 1),
              sql`EXISTS (
                SELECT 1 FROM ${relationship} 
                WHERE ${relationship.followerId} = ${currentUserId} 
                AND ${relationship.followedId} = ${post.userId}
              )`,
            ),
            // User's own posts (if enabled)
            options.includeOwnPosts ? eq(post.userId, currentUserId) : sql`FALSE`,
          ),
          // Exclude blocked users
          sql`NOT EXISTS (
            SELECT 1 FROM ${blockedUser} 
            WHERE (
              (${blockedUser.blockerId} = ${currentUserId} AND ${blockedUser.blockedId} = ${post.userId}) OR
              (${blockedUser.blockerId} = ${post.userId} AND ${blockedUser.blockedId} = ${currentUserId})
            )
          )`,
        ),
      );

    // Apply content type filtering
    if (options.contentTypes && options.contentTypes.length > 0) {
      query = query.where(
        and((query as any)._config.where, inArray(post.type, options.contentTypes)),
      );
    }

    // Apply ordering
    switch (options.orderBy) {
      case 'oldest':
        query = query.orderBy(asc(post.createdAt));
        break;
      case 'popular':
        query = query.orderBy(
          desc(post._saveCount),
          desc(post._commentCount),
          desc(post.createdAt),
        );
        break;
      case 'newest':
      default:
        query = query.orderBy(desc(post.createdAt));
        break;
    }

    // Apply pagination
    if (options.offset) {
      query = query.offset(options.offset);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  } catch (error) {
    console.error('Error filtering posts by privacy and following:', error);
    throw new Error('Failed to filter posts by privacy');
  }
}

/**
 * Get posts that are visible to a user (optimized version)
 * This function is optimized for discovery feed generation
 */
export async function getVisiblePostsForUser(
  currentUserId: string,
  bindings: Bindings,
  options: FilterOptions & {
    excludeSeenPosts?: string[];
    excludeUserIds?: string[];
    minCreatedAt?: string;
    maxCreatedAt?: string;
  } = {},
): Promise<PostWithPrivacy[]> {
  try {
    const db = createD1Client(bindings);

    // Get following relationships for the user
    const following = await db
      .select({ followedId: relationship.followedId })
      .from(relationship)
      .where(eq(relationship.followerId, currentUserId));

    const followingIds = following.map((f) => f.followedId);

    // Get blocked users (both directions)
    const blocked = await db
      .select({
        blockerId: blockedUser.blockerId,
        blockedId: blockedUser.blockedId,
      })
      .from(blockedUser)
      .where(
        or(eq(blockedUser.blockerId, currentUserId), eq(blockedUser.blockedId, currentUserId)),
      );

    const blockedUserIds = new Set([
      ...blocked.filter((b) => b.blockerId === currentUserId).map((b) => b.blockedId),
      ...blocked.filter((b) => b.blockedId === currentUserId).map((b) => b.blockerId),
    ]);

    // Build the main query
    let query = db
      .select({
        id: post.id,
        userId: post.userId,
        content: post.content,
        type: post.type,
        isDraft: post.isDraft,
        version: post.version,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        _saveCount: post._saveCount,
        _commentCount: post._commentCount,
        authorUsername: profile.username,
        authorIsPrivate: profile.isPrivate,
        authorVerifiedType: profile.verifiedType,
        authorProfileImage: profile.profileImage,
        authorBio: profile.bio,
      })
      .from(post)
      .innerJoin(profile, eq(post.userId, profile.userId))
      .where(
        and(
          eq(post.isDraft, 0), // Only published posts
          // Privacy filtering
          or(
            // Public posts
            eq(profile.isPrivate, 0),
            // Private posts from followed users
            and(
              eq(profile.isPrivate, 1),
              followingIds.length > 0 ? inArray(post.userId, followingIds) : sql`FALSE`,
            ),
            // User's own posts (if enabled)
            options.includeOwnPosts ? eq(post.userId, currentUserId) : sql`FALSE`,
          ),
          // Exclude blocked users
          blockedUserIds.size > 0
            ? sql`${post.userId} NOT IN (${Array.from(blockedUserIds)
                .map((id) => `'${id}'`)
                .join(',')})`
            : sql`TRUE`,
        ),
      );

    // Apply additional filters
    const conditions = [];

    if (!options.includeOwnPosts) {
      conditions.push(sql`${post.userId} != ${currentUserId}`);
    }

    if (options.excludeSeenPosts && options.excludeSeenPosts.length > 0) {
      conditions.push(
        sql`${post.id} NOT IN (${options.excludeSeenPosts.map((id) => `'${id}'`).join(',')})`,
      );
    }

    if (options.excludeUserIds && options.excludeUserIds.length > 0) {
      conditions.push(
        sql`${post.userId} NOT IN (${options.excludeUserIds.map((id) => `'${id}'`).join(',')})`,
      );
    }

    if (options.contentTypes && options.contentTypes.length > 0) {
      conditions.push(inArray(post.type, options.contentTypes));
    }

    if (options.minCreatedAt) {
      conditions.push(sql`${post.createdAt} >= ${options.minCreatedAt}`);
    }

    if (options.maxCreatedAt) {
      conditions.push(sql`${post.createdAt} <= ${options.maxCreatedAt}`);
    }

    // Apply all conditions
    if (conditions.length > 0) {
      query = query.where(and((query as any)._config.where, ...conditions));
    }

    // Apply ordering
    switch (options.orderBy) {
      case 'oldest':
        query = query.orderBy(asc(post.createdAt));
        break;
      case 'popular':
        query = query.orderBy(
          desc(post._saveCount),
          desc(post._commentCount),
          desc(post.createdAt),
        );
        break;
      case 'newest':
      default:
        query = query.orderBy(desc(post.createdAt));
        break;
    }

    // Apply pagination
    if (options.offset) {
      query = query.offset(options.offset);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  } catch (error) {
    console.error('Error getting visible posts for user:', error);
    throw new Error('Failed to get visible posts');
  }
}

/**
 * Check if a user can see a specific post
 */
export async function canUserSeePost(
  postId: string,
  currentUserId: string,
  bindings: Bindings,
): Promise<boolean> {
  try {
    const db = createD1Client(bindings);

    const result = await db
      .select({
        postId: post.id,
        authorId: post.userId,
        authorIsPrivate: profile.isPrivate,
        isFollowing: sql<number>`CASE 
          WHEN EXISTS (
            SELECT 1 FROM ${relationship} 
            WHERE ${relationship.followerId} = ${currentUserId} 
            AND ${relationship.followedId} = ${post.userId}
          ) THEN 1 ELSE 0 END`,
        isBlocked: sql<number>`CASE 
          WHEN EXISTS (
            SELECT 1 FROM ${blockedUser} 
            WHERE (
              (${blockedUser.blockerId} = ${currentUserId} AND ${blockedUser.blockedId} = ${post.userId}) OR
              (${blockedUser.blockerId} = ${post.userId} AND ${blockedUser.blockedId} = ${currentUserId})
            )
          ) THEN 1 ELSE 0 END`,
      })
      .from(post)
      .innerJoin(profile, eq(post.userId, profile.userId))
      .where(and(eq(post.id, postId), eq(post.isDraft, 0)))
      .limit(1);

    if (result.length === 0) return false;

    const postData = result[0];

    // User is blocked
    if (postData.isBlocked) return false;

    // User's own post
    if (postData.authorId === currentUserId) return true;

    // Public post
    if (postData.authorIsPrivate === 0) return true;

    // Private post - check if following
    if (postData.authorIsPrivate === 1 && postData.isFollowing === 1) return true;

    return false;
  } catch (error) {
    console.error('Error checking if user can see post:', error);
    throw new Error('Failed to check post visibility');
  }
}

/**
 * Get privacy statistics for a user's posts
 */
export async function getPostPrivacyStats(
  userId: string,
  bindings: Bindings,
): Promise<{
  totalPosts: number;
  publicPosts: number;
  privatePosts: number;
  visibleToFollowers: number;
  userIsPrivate: boolean;
}> {
  try {
    const db = createD1Client(bindings);

    const [userProfile, postStats] = await Promise.all([
      db
        .select({ isPrivate: profile.isPrivate })
        .from(profile)
        .where(eq(profile.userId, userId))
        .limit(1),

      db
        .select({
          totalPosts: sql<number>`COUNT(*)`,
          publicVisible: sql<number>`COUNT(CASE WHEN ${profile.isPrivate} = 0 THEN 1 END)`,
          privateVisible: sql<number>`COUNT(CASE WHEN ${profile.isPrivate} = 1 THEN 1 END)`,
        })
        .from(post)
        .innerJoin(profile, eq(post.userId, profile.userId))
        .where(and(eq(post.userId, userId), eq(post.isDraft, 0))),
    ]);

    const userIsPrivate = userProfile.length > 0 ? userProfile[0].isPrivate === 1 : false;
    const stats = postStats[0];

    return {
      totalPosts: stats.totalPosts,
      publicPosts: stats.publicVisible,
      privatePosts: stats.privateVisible,
      visibleToFollowers: userIsPrivate ? stats.totalPosts : stats.publicVisible,
      userIsPrivate,
    };
  } catch (error) {
    console.error('Error getting post privacy stats:', error);
    throw new Error('Failed to get post privacy stats');
  }
}

/**
 * Batch check post visibility for multiple posts and users
 */
export async function batchCheckPostVisibility(
  postIds: string[],
  currentUserId: string,
  bindings: Bindings,
): Promise<{ [postId: string]: boolean }> {
  try {
    const db = createD1Client(bindings);

    if (postIds.length === 0) return {};

    const results = await db
      .select({
        postId: post.id,
        authorId: post.userId,
        authorIsPrivate: profile.isPrivate,
        isFollowing: sql<number>`CASE 
          WHEN EXISTS (
            SELECT 1 FROM ${relationship} 
            WHERE ${relationship.followerId} = ${currentUserId} 
            AND ${relationship.followedId} = ${post.userId}
          ) THEN 1 ELSE 0 END`,
        isBlocked: sql<number>`CASE 
          WHEN EXISTS (
            SELECT 1 FROM ${blockedUser} 
            WHERE (
              (${blockedUser.blockerId} = ${currentUserId} AND ${blockedUser.blockedId} = ${post.userId}) OR
              (${blockedUser.blockerId} = ${post.userId} AND ${blockedUser.blockedId} = ${currentUserId})
            )
          ) THEN 1 ELSE 0 END`,
      })
      .from(post)
      .innerJoin(profile, eq(post.userId, profile.userId))
      .where(and(inArray(post.id, postIds), eq(post.isDraft, 0)));

    const visibility: { [postId: string]: boolean } = {};

    results.forEach((postData) => {
      let canSee = false;

      // User is blocked
      if (postData.isBlocked) {
        canSee = false;
      }
      // User's own post
      else if (postData.authorId === currentUserId) {
        canSee = true;
      }
      // Public post
      else if (postData.authorIsPrivate === 0) {
        canSee = true;
      }
      // Private post - check if following
      else if (postData.authorIsPrivate === 1 && postData.isFollowing === 1) {
        canSee = true;
      }

      visibility[postData.postId] = canSee;
    });

    // Set false for any missing posts
    postIds.forEach((postId) => {
      if (!(postId in visibility)) {
        visibility[postId] = false;
      }
    });

    return visibility;
  } catch (error) {
    console.error('Error batch checking post visibility:', error);
    throw new Error('Failed to batch check post visibility');
  }
}
