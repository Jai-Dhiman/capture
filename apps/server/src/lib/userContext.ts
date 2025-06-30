import { desc, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { extractTopicsFromPost, type UserContext } from './recommendation';

export async function buildUserContext(
  userId: string,
  db: DrizzleD1Database<typeof schema>,
): Promise<UserContext> {
  // Get user's recent interactions to derive preferences
  const recentInteractions = await db
    .select({
      postId: schema.savedPost.postId,
    })
    .from(schema.savedPost)
    .where(eq(schema.savedPost.userId, userId))
    .orderBy(desc(schema.savedPost.createdAt))
    .limit(50);

  const interactionPostIds = recentInteractions.map((i) => i.postId);

  const contentTypeStats = new Map<string, number>();
  const recentTopics = new Set<string>();

  if (interactionPostIds.length > 0) {
    // Fetch all relevant post data in a single, optimized query
    const posts = await db.query.post.findMany({
      where: (post, { inArray }) => inArray(post.id, interactionPostIds),
      with: {
        media: { columns: { type: true } },
        hashtags: { with: { hashtag: { columns: { name: true } } } },
      },
    });

    for (const post of posts) {
      // Determine content type
      const contentType = post.media.length > 0 ? post.media[0].type : 'text';
      contentTypeStats.set(contentType, (contentTypeStats.get(contentType) || 0) + 1);

      // Extract topics
      const topics = extractTopicsFromPost(
        post.content,
        post.hashtags.map((h) => h.hashtag.name),
      );
      for (const topic of topics) {
        recentTopics.add(topic);
      }
    }
  }

  // Normalize content type preferences to a 0-1 scale
  const totalInteractions = interactionPostIds.length || 1;
  const naturalContentPreferences: Record<string, number> = {};
  for (const [type, count] of contentTypeStats) {
    naturalContentPreferences[type] = count / totalInteractions;
  }

  return {
    naturalContentPreferences,
    recentTopics,
  };
} 