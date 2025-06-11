import { createD1Client } from '@/db';
import * as schema from '@/db/schema';
import type { Bindings } from '@/types';
import {
  generatePostEmbedding,
  storePostEmbedding,
  generateEmbedding,
  type VectorData,
} from '../lib/embeddings';
import { QdrantClient } from '../lib/qdrantClient';
import { inArray, eq, desc } from 'drizzle-orm';
import type { MessageBatch } from '@cloudflare/workers-types';

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
        console.log(`[handlePostQueue][${messageId}] Processing message for postId: ${postId}`);
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

        console.log(`[handlePostQueue][${messageId}] Found post:`, post);

        const hashtags = await db
          .select({ name: schema.hashtag.name })
          .from(schema.postHashtag)
          .where(eq(schema.postHashtag.postId, postId))
          .leftJoin(schema.hashtag, eq(schema.hashtag.id, schema.postHashtag.hashtagId))
          .all()
          .then((rows) => rows.map((r) => r.name));
        const validHashtags = hashtags.filter((tag): tag is string => tag !== null);

        const vectorData = await generatePostEmbedding(postId, post.content, validHashtags, env.AI);

        if (!vectorData || !Array.isArray(vectorData.vector) || vectorData.vector.length === 0) {
          console.error(
            `[handlePostQueue][${messageId}] Failed to generate valid embedding vector for post ${postId}. Retrying message.`,
          );
          message.retry();
          return;
        }

        console.log(`[handlePostQueue][${messageId}] Generated vector:`, vectorData.vector);

        await storePostEmbedding(vectorData, env.POST_VECTORS, qdrantClient);

        try {
          console.log(`[handlePostQueue][${messageId}] Sending to USER_VECTOR_QUEUE: ${post.userId}`);
          await env.USER_VECTOR_QUEUE.send({ userId: post.userId });
        } catch (queueError) {
          console.error(
            `[handlePostQueue][${messageId}] FAILED to send userId ${post.userId} to USER_VECTOR_QUEUE for post ${postId}:`,
            queueError,
          );
        }

        console.log(`[handlePostQueue][${messageId}] Acknowledging message`);
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
  // ... unchanged
}
