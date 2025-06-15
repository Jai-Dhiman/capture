import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createD1Client } from '../db';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../types';

const interstsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

interstsRouter.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    // Should be caught by authMiddleware, but good practice
    return c.json({ error: 'Authentication required' }, 401);
  }
  const userId = user.id;
  const db = createD1Client(c.env);
  const userVectorsKV = c.env.USER_VECTORS;
  const POST_LIMIT = 20; // Consistent with queue logic

  if (!userVectorsKV) {
    console.error(`[interests] USER_VECTORS KV binding missing for user ${userId}`);
    return c.json({ error: 'Server configuration error' }, 500);
  }

  try {
    // 1. Fetch User Embedding Vector & Check Existence
    const userVectorData = await userVectorsKV.get<number[]>(userId, { type: 'json' });
    const userVectorExists =
      userVectorData !== null && Array.isArray(userVectorData) && userVectorData.length > 0;
    // 2. Fetch Source Posts (Saved & Created)
    const savedPostsQuery = db
      .select({
        id: schema.post.id,
        content: schema.post.content,
        savedAt: schema.savedPost.createdAt, // Select the column used for ordering
      })
      .from(schema.savedPost)
      .leftJoin(schema.post, eq(schema.savedPost.postId, schema.post.id))
      .where(
        and(
          // Add check to ensure the joined post is not null
          eq(schema.savedPost.userId, userId),
          sql`${schema.post.id} IS NOT NULL`,
        ),
      )
      .orderBy(desc(schema.savedPost.createdAt)) // Order by the selected alias
      .limit(POST_LIMIT);

    const createdPostsQuery = db
      .select({
        id: schema.post.id,
        content: schema.post.content,
        createdAt: schema.post.createdAt, // Select the column used for ordering
      })
      .from(schema.post)
      .where(eq(schema.post.userId, userId))
      .orderBy(desc(schema.post.createdAt)) // Order by the selected alias
      .limit(POST_LIMIT);

    const [savedPostsRaw, createdPostsRaw] = await Promise.all([
      savedPostsQuery,
      createdPostsQuery,
    ]);

    const allPostIds = [
      ...new Set([...savedPostsRaw.map((p) => p.id), ...createdPostsRaw.map((p) => p.id)]),
    ].filter((id) => id != null) as string[]; // Ensure filtering non-null IDs

    const postHashtagsMap = new Map<string, string[]>();
    const relevantHashtagsSet = new Set<string>();

    // 3. Fetch Hashtags for these posts if any exist
    if (allPostIds.length > 0) {
      const hashtagsResult = await db
        .select({
          postId: schema.postHashtag.postId,
          name: schema.hashtag.name,
        })
        .from(schema.postHashtag)
        .leftJoin(schema.hashtag, eq(schema.postHashtag.hashtagId, schema.hashtag.id))
        .where(inArray(schema.postHashtag.postId, allPostIds));

      for (const row of hashtagsResult) {
        if (row.postId && row.name) {
          const currentTags = postHashtagsMap.get(row.postId) ?? [];
          currentTags.push(row.name);
          postHashtagsMap.set(row.postId, currentTags);
          relevantHashtagsSet.add(row.name);
        }
      }
    }
    // 4. Format Source Data
    const savedPosts = savedPostsRaw
      .filter((p) => p.id && p.content) // Ensure post data is valid
      .map((p) => ({
        id: p.id!,
        content: p.content!,
        hashtags: postHashtagsMap.get(p.id!) || [],
      }));

    const createdPosts = createdPostsRaw
      .filter((p) => p.id && p.content) // Ensure post data is valid
      .map((p) => ({
        id: p.id!,
        content: p.content!,
        hashtags: postHashtagsMap.get(p.id!) || [],
      }));

    const relevantHashtags = Array.from(relevantHashtagsSet);

    // 5. Construct Response
    const responsePayload = {
      userVectorExists,
      sourceData: {
        savedPosts,
        createdPosts,
        relevantHashtags,
      },
    };

    return c.json(responsePayload);
  } catch (error) {
    console.error(`[interests] FAILED to fetch interest data for user ${userId}:`, error);
    return c.json({ error: 'Failed to fetch interest data' }, 500);
  }
});

export default interstsRouter;
