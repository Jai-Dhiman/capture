import { Hono } from 'hono';
import { createD1Client } from '../db';
import * as schema from '../db/schema';
import type { Bindings } from 'types';
import {
  generatePostEmbedding,
  storePostEmbedding,
  generateUserEmbedding,
  storeUserEmbedding,
} from '../lib/embeddings';
import { inArray, eq } from 'drizzle-orm';
import type { MessageBatch } from '@cloudflare/workers-types';

const router = new Hono<{ Bindings: Bindings }>();

// 2) User‐queue: re‐embed user interest
router.post('/user-vector-queue', async (c) => {
  const { userId } = await c.req.json<{ userId: string }>();
  const env = c.env as unknown as Bindings;
  const db = createD1Client(env);

  // gather interests: saved posts, own posts, and hashtags
  const ownPosts = await db
    .select({ id: schema.post.id, content: schema.post.content })
    .from(schema.post)
    .where(eq(schema.post.userId, userId))
    .all();

  const savedRows = await db
    .select({ postId: schema.savedPost.postId })
    .from(schema.savedPost)
    .where(eq(schema.savedPost.userId, userId))
    .all();
  const savedPostIds = savedRows.map((r) => r.postId);
  let savedContents: string[] = [];
  if (savedPostIds.length > 0) {
    const savedPosts = await db
      .select({ content: schema.post.content })
      .from(schema.post)
      .where(inArray(schema.post.id, savedPostIds))
      .all();
    savedContents = savedPosts.map((p) => p.content);
  }

  // fetch hashtags from all user posts
  const allPostIds = [...ownPosts.map((p) => p.id), ...savedPostIds];
  let hashtagNames: string[] = [];
  if (allPostIds.length > 0) {
    const hashtagRows = await db
      .select({ hashtagId: schema.postHashtag.hashtagId })
      .from(schema.postHashtag)
      .where(inArray(schema.postHashtag.postId, allPostIds))
      .all();
    const hashtagIds = [...new Set(hashtagRows.map((r) => r.hashtagId))].filter(Boolean);
    if (hashtagIds.length > 0) {
      const hashtags = await db
        .select({ name: schema.hashtag.name })
        .from(schema.hashtag)
        .where(inArray(schema.hashtag.id, hashtagIds))
        .all();
      hashtagNames = hashtags.map((h) => h.name);
    }
  }

  // combine interests (duplicate saved post content for higher weight)
  const interests: string[] = [
    ...savedContents.flatMap((c) => [c, c]),
    ...ownPosts.map((p) => p.content),
    ...hashtagNames,
  ];

  const vectorData = await generateUserEmbedding(userId, interests, env.AI);
  await storeUserEmbedding(vectorData, env.POST_VECTORS, env.VECTORIZE);

  return c.text('OK');
});

export default router;

// --- Queue Handlers ---

export async function handlePostQueue(
  batch: MessageBatch<{ postId: string }>,
  env: Bindings,
): Promise<void> {
  const db = createD1Client(env);
  const promises: Promise<void>[] = [];

  for (const message of batch.messages) {
    const postId = message.body.postId;
    const messageId = message.id; // Get message ID for tracking

    const processingPromise = (async () => {
      try {
        // Fetch post
        const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get();
        if (!post) {
          console.error(
            `[handlePostQueue][${messageId}] Post not found: ${postId}. Acknowledging message.`,
          );
          message.ack();
          return;
        }
        // Fetch hashtags
        const hashtags = await db
          .select({ name: schema.hashtag.name })
          .from(schema.postHashtag)
          .where(eq(schema.postHashtag.postId, postId))
          .leftJoin(schema.hashtag, eq(schema.hashtag.id, schema.postHashtag.hashtagId))
          .all()
          .then((rows) => rows.map((r) => r.name));
        const validHashtags = hashtags.filter((tag): tag is string => tag !== null);

        // Generate embedding
        const vectorData = await generatePostEmbedding(postId, post.content, validHashtags, env.AI);
        // Check if vectorData.vector exists and is a non-empty array
        if (!vectorData || !Array.isArray(vectorData.vector) || vectorData.vector.length === 0) {
          console.error(
            `[handlePostQueue][${messageId}] Failed to generate valid embedding vector for post ${postId}. Retrying message.`,
          );
          message.retry();
          return;
        }
        // Store embedding
        await storePostEmbedding(vectorData, env.POST_VECTORS, env.VECTORIZE);
        message.ack();
      } catch (error) {
        console.error(
          `[handlePostQueue][${messageId}] FAILED to process postId ${postId}:`,
          error instanceof Error ? error.message : error,
          error instanceof Error ? error.stack : '',
        );
        message.retry(); // Retry message on failure
      }
    })();
    promises.push(processingPromise);
  }
  await Promise.all(promises);
}
