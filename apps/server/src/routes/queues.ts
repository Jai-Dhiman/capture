import { createD1Client } from '@/db';
import * as schema from '@/db/schema';
import type { Bindings } from '@/types';
import type { MessageBatch } from '@cloudflare/workers-types';
import { desc, eq, inArray } from 'drizzle-orm';
import {
  type VectorData,
  generateEmbedding,
  generatePostEmbedding,
  storePostEmbedding,
} from '../lib/embeddings';
import { QdrantClient } from '../lib/qdrantClient';
import { sql } from 'drizzle-orm';

function calculateAverageVector(
  savedVectors: number[][],
  createdVectors: number[][],
  hashtagVectors: number[][] = [],
  savedWeight = 2,
  tagWeight = 1,
): number[] | null {
  const allVectors = [
    ...savedVectors.flatMap((v) => Array(savedWeight).fill(v)),
    ...createdVectors,
    ...hashtagVectors.flatMap((v) => Array(tagWeight).fill(v)),
  ];

  if (allVectors.length === 0) {
    return null;
  }

  const vectorLength = allVectors[0].length;
  const sumVector = new Array(vectorLength).fill(0);

  for (const vector of allVectors) {
    if (vector.length !== vectorLength) {
      console.warn('Inconsistent vector lengths found, skipping vector:', vector);
      continue;
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
  const qdrantClient = new QdrantClient(env);
  const promises: Promise<void>[] = [];

  for (const message of batch.messages) {
    const postId = message.body.postId;
    const messageId = message.id;

    const processingPromise = (async () => {
      try {
        const post = await db
          .select({
            id: schema.post.id,
            content: schema.post.content,
            userId: schema.post.userId,
            authorIsPrivate: schema.profile.isPrivate,
          })
          .from(schema.post)
          .leftJoin(schema.profile, eq(schema.post.userId, schema.profile.userId))
          .where(eq(schema.post.id, postId))
          .get();

        if (!post || !post.userId) {
          console.error(
            `[handlePostQueue][${messageId}] Post or userId not found: ${postId}. Retrying message.`,
          );
          message.retry();
          return;
        }

        const hashtags = await db
          .select({ name: schema.hashtag.name })
          .from(schema.postHashtag)
          .where(eq(schema.postHashtag.postId, postId))
          .leftJoin(schema.hashtag, eq(schema.hashtag.id, schema.postHashtag.hashtagId))
          .all()
          .then((rows) => rows.map((r) => r.name));
        const validHashtags = hashtags.filter((tag): tag is string => tag !== null);

        const vectorData = await generatePostEmbedding(
          postId,
          post.content,
          validHashtags,
          env.AI,
          post.userId,
          !!post.authorIsPrivate,
        );

        if (!vectorData || !Array.isArray(vectorData.vector) || vectorData.vector.length === 0) {
          console.error(
            `[handlePostQueue][${messageId}] Failed to generate valid embedding vector for post ${postId}. Retrying message.`,
          );
          message.retry();
          return;
        }

        await storePostEmbedding(vectorData, env.POST_VECTORS, qdrantClient);

        try {
          await env.USER_VECTOR_QUEUE.send({ userId: post.userId });
        } catch (queueError) {
          console.error(
            `[handlePostQueue][${messageId}] FAILED to send userId ${post.userId} to USER_VECTOR_QUEUE for post ${postId}:`,
            queueError,
          );
        }

        message.ack();
      } catch (error) {
        console.error(
          `[handlePostQueue][${messageId}] FAILED to process postId ${postId}:`,
          error instanceof Error ? error.message : error,
          error instanceof Error ? error.stack : '',
        );
        message.retry();
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
  const promises: Promise<void>[] = [];
  const POST_LIMIT = 20; // Consistent with interests endpoint

  for (const message of batch.messages) {
    const userId = message.body.userId;
    const messageId = message.id;

    const processingPromise = (async () => {
      try {
        console.debug(`[handleUserEmbeddingQueue][${messageId}] Processing user ${userId}`);

        // 1. Fetch user's saved posts (recent, weighted higher)
        const savedPostsResult = await db
          .select({
            postId: schema.savedPost.postId,
            savedAt: schema.savedPost.createdAt,
          })
          .from(schema.savedPost)
          .where(eq(schema.savedPost.userId, userId))
          .orderBy(desc(schema.savedPost.createdAt))
          .limit(POST_LIMIT);

        // 2. Fetch user's created posts (recent)
        const createdPostsResult = await db
          .select({
            id: schema.post.id,
            createdAt: schema.post.createdAt,
          })
          .from(schema.post)
          .where(eq(schema.post.userId, userId))
          .orderBy(desc(schema.post.createdAt))
          .limit(POST_LIMIT);

        const savedPostIds = savedPostsResult.map((p) => p.postId).filter(Boolean);
        const createdPostIds = createdPostsResult.map((p) => p.id).filter(Boolean);
        const allPostIds = [...new Set([...savedPostIds, ...createdPostIds])];

        if (allPostIds.length === 0) {
          console.debug(
            `[handleUserEmbeddingQueue][${messageId}] No posts found for user ${userId}, storing null vector`,
          );
          await env.USER_VECTORS.delete(userId);
          message.ack();
          return;
        }

        // 3. Fetch vectors from KV for these posts
        const savedVectors: number[][] = [];
        const createdVectors: number[][] = [];

        // Get saved post vectors
        for (const postId of savedPostIds) {
          try {
            const vectorData = await env.POST_VECTORS.get<{ vector: number[] }>(`post:${postId}`, {
              type: 'json',
            });
            if (vectorData?.vector && Array.isArray(vectorData.vector)) {
              savedVectors.push(vectorData.vector);
            }
          } catch (error) {
            console.warn(
              `[handleUserEmbeddingQueue][${messageId}] Failed to get vector for saved post ${postId}:`,
              error,
            );
          }
        }

        // Get created post vectors
        for (const postId of createdPostIds) {
          try {
            const vectorData = await env.POST_VECTORS.get<{ vector: number[] }>(`post:${postId}`, {
              type: 'json',
            });
            if (vectorData?.vector && Array.isArray(vectorData.vector)) {
              createdVectors.push(vectorData.vector);
            }
          } catch (error) {
            console.warn(
              `[handleUserEmbeddingQueue][${messageId}] Failed to get vector for created post ${postId}:`,
              error,
            );
          }
        }

        // 4. Get hashtag vectors for frequently used hashtags
        const hashtagVectors: number[][] = [];
        try {
          const frequentHashtags = await db
            .select({
              name: schema.hashtag.name,
              count: sql<number>`COUNT(*)`.as('count'),
            })
            .from(schema.postHashtag)
            .leftJoin(schema.hashtag, eq(schema.postHashtag.hashtagId, schema.hashtag.id))
            .where(inArray(schema.postHashtag.postId, allPostIds))
            .groupBy(schema.hashtag.name)
            .orderBy(desc(sql`COUNT(*)`))
            .limit(5); // Top 5 hashtags

          for (const hashtag of frequentHashtags) {
            if (hashtag.name) {
              try {
                const hashtagVector = await generateEmbedding(hashtag.name, env.AI);
                if (hashtagVector && Array.isArray(hashtagVector)) {
                  hashtagVectors.push(hashtagVector);
                }
              } catch (error) {
                console.warn(
                  `[handleUserEmbeddingQueue][${messageId}] Failed to generate hashtag vector for ${hashtag.name}:`,
                  error,
                );
              }
            }
          }
        } catch (error) {
          console.warn(
            `[handleUserEmbeddingQueue][${messageId}] Failed to process hashtags for user ${userId}:`,
            error,
          );
        }

        // 5. Calculate average user vector
        const userVector = calculateAverageVector(savedVectors, createdVectors, hashtagVectors);

        if (!userVector) {
          console.warn(
            `[handleUserEmbeddingQueue][${messageId}] Failed to calculate user vector for ${userId}`,
          );
          await env.USER_VECTORS.delete(userId);
          message.ack();
          return;
        }

        // 6. Store user vector in KV
        await env.USER_VECTORS.put(userId, JSON.stringify(userVector));

        console.debug(
          `[handleUserEmbeddingQueue][${messageId}] Successfully updated user vector for ${userId} using ${savedVectors.length} saved, ${createdVectors.length} created, ${hashtagVectors.length} hashtag vectors`,
        );

        message.ack();
      } catch (error) {
        console.error(
          `[handleUserEmbeddingQueue][${messageId}] FAILED to process userId ${userId}:`,
          error instanceof Error ? error.message : error,
          error instanceof Error ? error.stack : '',
        );
        message.retry();
      }
    })();

    promises.push(processingPromise);
  }

  await Promise.all(promises);
}
