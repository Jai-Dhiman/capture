import {
  users,
  profile,
  post,
  comment,
  savedPost,
  postLike,
  commentLike,
  relationship,
  userActivity,
  notification,
} from '@/db/schema';
import type { Bindings } from '@/types';
import { Hono } from 'hono';
import { count, desc, eq, gte, lt, and, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

const analytics = new Hono<{
  Bindings: Bindings;
}>();

// Analytics overview endpoint
analytics.get('/overview', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    // Get current timestamp and time ranges
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastWeekIso = lastWeek.toISOString();
    const lastMonthIso = lastMonth.toISOString();

    // Parallel queries for better performance
    const [
      totalUsers,
      verifiedUsers,
      weeklyNewUsers,
      monthlyNewUsers,
      totalPosts,
      weeklyNewPosts,
      monthlyNewPosts,
      totalComments,
      weeklyNewComments,
      totalSaves,
      totalPostLikes,
      totalCommentLikes,
      totalRelationships,
      privateProfiles,
    ] = await Promise.all([
      // User metrics
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(profile).where(eq(profile.verifiedType, 'verified')),
      db.select({ count: count() }).from(users).where(gte(users.createdAt, lastWeekIso)),
      db.select({ count: count() }).from(users).where(gte(users.createdAt, lastMonthIso)),

      // Post metrics
      db.select({ count: count() }).from(post).where(eq(post.isDraft, 0)),
      db.select({ count: count() }).from(post).where(and(eq(post.isDraft, 0), gte(post.createdAt, lastWeekIso))),
      db.select({ count: count() }).from(post).where(and(eq(post.isDraft, 0), gte(post.createdAt, lastMonthIso))),

      // Comment metrics
      db.select({ count: count() }).from(comment).where(eq(comment.isDeleted, 0)),
      db.select({ count: count() }).from(comment).where(and(eq(comment.isDeleted, 0), gte(comment.createdAt, lastWeekIso))),

      // Engagement metrics
      db.select({ count: count() }).from(savedPost),
      db.select({ count: count() }).from(postLike),
      db.select({ count: count() }).from(commentLike),
      db.select({ count: count() }).from(relationship),
      db.select({ count: count() }).from(profile).where(eq(profile.isPrivate, 1)),
    ]);

    // Calculate engagement rate (likes + saves + comments) per post
    const engagementRate = totalPosts[0].count > 0 
      ? ((totalPostLikes[0].count + totalSaves[0].count + totalComments[0].count) / totalPosts[0].count).toFixed(2)
      : '0.00';

    const response = {
      users: {
        total: totalUsers[0].count,
        verified: verifiedUsers[0].count,
        private: privateProfiles[0].count,
        weeklyGrowth: weeklyNewUsers[0].count,
        monthlyGrowth: monthlyNewUsers[0].count,
        verificationRate: totalUsers[0].count > 0 
          ? ((verifiedUsers[0].count / totalUsers[0].count) * 100).toFixed(1) + '%'
          : '0%',
      },
      content: {
        posts: {
          total: totalPosts[0].count,
          weeklyNew: weeklyNewPosts[0].count,
          monthlyNew: monthlyNewPosts[0].count,
        },
        comments: {
          total: totalComments[0].count,
          weeklyNew: weeklyNewComments[0].count,
          averagePerPost: totalPosts[0].count > 0 
            ? (totalComments[0].count / totalPosts[0].count).toFixed(1)
            : '0',
        },
      },
      engagement: {
        totalSaves: totalSaves[0].count,
        totalPostLikes: totalPostLikes[0].count,
        totalCommentLikes: totalCommentLikes[0].count,
        totalFollows: totalRelationships[0].count,
        engagementRate: engagementRate,
        savesPerPost: totalPosts[0].count > 0 
          ? (totalSaves[0].count / totalPosts[0].count).toFixed(1)
          : '0',
      },
      timestamp: now.toISOString(),
    };

    return c.json(response);
  } catch (error) {
    console.error('Analytics overview error:', error);
    return c.json({ error: 'Failed to fetch analytics data' }, 500);
  }
});

// User growth trends endpoint
analytics.get('/user-growth', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    // Get daily user signups for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const userGrowth = await db
      .select({
        date: sql<string>`date(${users.createdAt})`,
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo.toISOString()))
      .groupBy(sql`date(${users.createdAt})`)
      .orderBy(sql`date(${users.createdAt})`);

    return c.json({
      period: '30_days',
      data: userGrowth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('User growth analytics error:', error);
    return c.json({ error: 'Failed to fetch user growth data' }, 500);
  }
});

// Content activity endpoint
analytics.get('/content-activity', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    // Get daily content creation for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [postActivity, commentActivity] = await Promise.all([
      db
        .select({
          date: sql<string>`date(${post.createdAt})`,
          count: count(),
        })
        .from(post)
        .where(and(eq(post.isDraft, 0), gte(post.createdAt, thirtyDaysAgo.toISOString())))
        .groupBy(sql`date(${post.createdAt})`)
        .orderBy(sql`date(${post.createdAt})`),
      
      db
        .select({
          date: sql<string>`date(${comment.createdAt})`,
          count: count(),
        })
        .from(comment)
        .where(and(eq(comment.isDeleted, 0), gte(comment.createdAt, thirtyDaysAgo.toISOString())))
        .groupBy(sql`date(${comment.createdAt})`)
        .orderBy(sql`date(${comment.createdAt})`),
    ]);

    return c.json({
      period: '30_days',
      posts: postActivity,
      comments: commentActivity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Content activity analytics error:', error);
    return c.json({ error: 'Failed to fetch content activity data' }, 500);
  }
});

// Top users by engagement
analytics.get('/top-users', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const topUsers = await db
      .select({
        userId: post.userId,
        username: profile.username,
        profileImage: profile.profileImage,
        verifiedType: profile.verifiedType,
        postCount: count(post.id),
        totalSaves: sql<number>`COALESCE(SUM(${post._saveCount}), 0)`,
        totalComments: sql<number>`COALESCE(SUM(${post._commentCount}), 0)`,
      })
      .from(post)
      .innerJoin(profile, eq(post.userId, profile.userId))
      .where(eq(post.isDraft, 0))
      .groupBy(post.userId, profile.username, profile.profileImage, profile.verifiedType)
      .orderBy(desc(sql`COALESCE(SUM(${post._saveCount}), 0) + COALESCE(SUM(${post._commentCount}), 0)`))
      .limit(10);

    return c.json({
      users: topUsers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Top users analytics error:', error);
    return c.json({ error: 'Failed to fetch top users data' }, 500);
  }
});

// Recent activity summary
analytics.get('/recent-activity', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      recentPosts,
      recentComments,
      recentLikes,
      recentFollows,
    ] = await Promise.all([
      db.select({ count: count() }).from(post).where(and(eq(post.isDraft, 0), gte(post.createdAt, last24Hours))),
      db.select({ count: count() }).from(comment).where(and(eq(comment.isDeleted, 0), gte(comment.createdAt, last24Hours))),
      db.select({ count: count() }).from(postLike).where(gte(postLike.createdAt, last24Hours)),
      db.select({ count: count() }).from(relationship).where(gte(relationship.createdAt, last24Hours)),
    ]);

    return c.json({
      period: '24_hours',
      activity: {
        posts: recentPosts[0].count,
        comments: recentComments[0].count,
        likes: recentLikes[0].count,
        follows: recentFollows[0].count,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Recent activity analytics error:', error);
    return c.json({ error: 'Failed to fetch recent activity data' }, 500);
  }
});

export default analytics;