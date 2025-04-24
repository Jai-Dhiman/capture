import { createD1Client } from '../db';
import * as schema from '../db/schema';
import type { Bindings } from 'types';
import { generatePostEmbedding, storePostEmbedding } from '../lib/embeddings';
import { inArray, eq, desc } from 'drizzle-orm';
import type { MessageBatch } from '@cloudflare/workers-types';

function calculateAverageVector(
  savedVectors: number[][],
  createdVectors: number[][],
  savedWeight: number = 2,
): number[] | null {
  const allVectors = [
    ...savedVectors.flatMap((v) => Array(savedWeight).fill(v)),
    ...createdVectors,
  ];

  if (allVectors.length === 0) {
    return null;
  }

  const vectorLength = allVectors[0].length;
  const sumVector = new Array(vectorLength).fill(0);

  for (const vector of allVectors) {
    if (vector.length !== vectorLength) {
      console.warn('Inconsistent vector lengths found, skipping vector:', vector);
      continue; // Skip vectors with inconsistent length
    }
    for (let i = 0; i < vectorLength; i++) {
      sumVector[i] += vector[i];
    }
  }

  const averageVector = sumVector.map((sum) => sum / allVectors.length);
  return averageVector;
}

// Post Queue Handlers
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
        const post = await db
          .select({
            id: schema.post.id,
            content: schema.post.content,
            userId: schema.post.userId,
          })
          .from(schema.post)
          .where(eq(schema.post.id, postId))
          .get();

        if (!post || !post.userId) {
          console.error(
            `[handlePostQueue][${messageId}] Post or userId not found: ${postId}. Acknowledging message.`,
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
        console.log(
          `[handlePostQueue][${messageId}] Successfully stored embedding for post ${postId}`,
        );

        // --- Trigger user embedding update ---
        try {
          await env.USER_VECTOR_QUEUE.send({ userId: post.userId });
          console.log(
            `[handlePostQueue][${messageId}] Sent userId ${post.userId} to USER_VECTOR_QUEUE for post ${postId}`,
          );
        } catch (queueError) {
          console.error(
            `[handlePostQueue][${messageId}] FAILED to send userId ${post.userId} to USER_VECTOR_QUEUE for post ${postId}:`,
            queueError,
          );
          // Decide if this failure should prevent ack. Usually not, as the post embedding IS stored.
        }
        // --- END Trigger user embedding update ---

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

// User Embedding Queue Handler
export async function handleUserEmbeddingQueue(
  batch: MessageBatch<{ userId: string }>,
  env: Bindings,
): Promise<void> {
  const db = createD1Client(env);
  const userVectorsKV = env.USER_VECTORS;
  const postVectorsKV = env.POST_VECTORS;
  const promises: Promise<void>[] = [];
  const COOLDOWN_SECONDS = 300; // 5 minutes

  for (const message of batch.messages) {
    const userId = message.body.userId;
    const messageId = message.id; // For logging
    const cooldownKey = `user-vector-cooldown:${userId}`;
    const userVectorKey = `user-vector:${userId}`;

    const processingPromise = (async () => {
      try {
        // 1. Cooldown Check
        const cooling = await userVectorsKV.get(cooldownKey);
        if (cooling) {
          console.log(`[UserQueue][${messageId}] User ${userId} is in cooldown. Skipping.`);
          message.ack();
          return;
        }
        // 2. Fetch relevant Post IDs (e.g., last 20 saved, last 20 created)
        const recentSavedPosts = await db
          .select({ postId: schema.savedPost.postId })
          .from(schema.savedPost)
          .where(eq(schema.savedPost.userId, userId))
          .orderBy(desc(schema.savedPost.createdAt))
          .limit(20) // Limit scope
          .all();
        const savedPostIds = recentSavedPosts.map((r) => r.postId);

        const recentCreatedPosts = await db
          .select({ id: schema.post.id })
          .from(schema.post)
          .where(eq(schema.post.userId, userId))
          .orderBy(desc(schema.post.createdAt))
          .limit(20) // Limit scope
          .all();
        const createdPostIds = recentCreatedPosts.map((p) => p.id);

        const uniquePostIds = [...new Set([...savedPostIds, ...createdPostIds])];

        if (uniquePostIds.length === 0) {
          console.log(
            `[UserQueue][${messageId}] No recent saved or created posts found for user ${userId}. Skipping.`,
          );
          // Set cooldown anyway to avoid constant re-checking if user is inactive
          await userVectorsKV.put(cooldownKey, 'no_posts', { expirationTtl: COOLDOWN_SECONDS });
          message.ack();
          return;
        }

        // 3. Fetch Post Embeddings from POST_VECTORS KV
        const postVectorKeys = uniquePostIds.map((id) => `post:${id}`);
        // Note: KV list/bulk operations might be more efficient for many keys
        const kvResults = await Promise.all(
          postVectorKeys.map((key) => postVectorsKV.get<number[]>(key, { type: 'json' })),
        );

        const savedVectors: number[][] = [];
        const createdVectors: number[][] = [];
        const fetchedEmbeddings = new Map<string, number[]>();

        uniquePostIds.forEach((postId, index) => {
          const vector = kvResults[index];
          if (vector && Array.isArray(vector) && vector.length > 0) {
            fetchedEmbeddings.set(postId, vector);
            if (savedPostIds.includes(postId)) {
              savedVectors.push(vector);
            }
            // Add to created even if also saved (post is still user's creation)
            if (createdPostIds.includes(postId)) {
              createdVectors.push(vector);
            }
          } else {
            console.warn(
              `[UserQueue][${messageId}] Embedding not found or invalid in KV for post ${postId}`,
            );
          }
        });

        // 4. Calculate Average Embedding
        const averageVector = calculateAverageVector(savedVectors, createdVectors);

        if (!averageVector) {
          console.log(
            `[UserQueue][${messageId}] No valid post embeddings found to average for user ${userId}. Skipping.`,
          );
          // Set cooldown
          await userVectorsKV.put(cooldownKey, 'no_vectors', { expirationTtl: COOLDOWN_SECONDS });
          message.ack();
          return;
        }

        // 5. Store User Embedding in USER_VECTORS KV
        await userVectorsKV.put(userVectorKey, JSON.stringify(averageVector));

        // 6. Set Cooldown
        await userVectorsKV.put(cooldownKey, 'processed', { expirationTtl: COOLDOWN_SECONDS });

        console.log(`[UserQueue][${messageId}] Successfully updated embedding for user ${userId}`);
        message.ack();
      } catch (error) {
        console.error(
          `[UserQueue][${messageId}] FAILED to process userId ${userId}:`,
          error instanceof Error ? error.message : error,
          error instanceof Error ? error.stack : '',
        );
        // TODO: Decide whether to retry or ack based on error type if possible
        message.retry();
      }
    })();
    promises.push(processingPromise);
  }
  await Promise.all(promises);
}
