import { createD1Client } from '../db/index.js';
import * as schema from '../db/schema.js';
import type { Bindings } from '../types/index.js';
import type { MessageBatch } from '@cloudflare/workers-types';
import { desc, eq, inArray } from 'drizzle-orm';
import { QdrantClient } from '../lib/infrastructure/qdrantClient';
import { sql } from 'drizzle-orm';
import { createEmbeddingService } from '../lib/ai/embeddingService';
import { createCachingService } from '../lib/cache/cachingService';
import { OptimizedVectorOps } from '../lib/wasm/wasmUtils';

// Configuration constants
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

interface ProcessingResult {
  success: boolean;
  messageId: string;
  error?: Error;
  processingTime: number;
  retryCount: number;
}

interface BatchGroup {
  contentType: 'text' | 'image' | 'multimodal';
  messages: Array<{
    message: any;
    postId: string;
    content: string;
    hashtags: string[];
    postType?: 'text' | 'image' | 'multimodal';
  }>;
}

// Simplified metrics for beta
let processedCount = 0;

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

// Enhanced Post Queue Handlers with Batch Processing
export async function handlePostQueue(
  batch: MessageBatch<{ postId: string }>,
  env: Bindings,
): Promise<void> {
  const logger = createLogger('handlePostQueue');
  const startTime = Date.now();
  
  logger.info(`Processing batch of ${batch.messages.length} messages`);
  
  try {
    // Group messages by content type for batch processing
    const batchGroups = await groupMessagesByContentType([...batch.messages], env);
    
    // Process each group using Promise.allSettled for better error handling
    const groupResults = await Promise.allSettled(
      batchGroups.map(group => processBatchGroup(group, env))
    );
    
    // Process individual results and handle any failures
    await handleBatchResults(groupResults);
    
    const processingTime = Date.now() - startTime;
    processedCount += batch.messages.length;
    
    logger.info(`Batch processing completed in ${processingTime}ms`);
    
  } catch (error) {
    logger.error('Critical error in batch processing:', error);
    // Fallback to individual processing
    await fallbackIndividualProcessing([...batch.messages], env);
  }
}

async function groupMessagesByContentType(
  messages: any[],
  env: Bindings
): Promise<BatchGroup[]> {
  const db = createD1Client(env);
  const groups = new Map<string, BatchGroup>();
  
  for (const message of messages) {
    const postId = message.body.postId;
    
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
        continue;
      }
      
      const hashtags = await db
        .select({ name: schema.hashtag.name })
        .from(schema.postHashtag)
        .where(eq(schema.postHashtag.postId, postId))
        .leftJoin(schema.hashtag, eq(schema.hashtag.id, schema.postHashtag.hashtagId))
        .all()
        .then((rows) => rows.map((r) => r.name));
      const validHashtags = hashtags.filter((tag): tag is string => tag !== null);
      
      // Determine content type for batching
      const contentType = await determineContentType(postId, post.content, validHashtags, db);
      
      if (!groups.has(contentType)) {
        groups.set(contentType, {
          contentType,
          messages: []
        });
      }
      
      groups.get(contentType)!.messages.push({
        message,
        postId,
        content: post.content,
        hashtags: validHashtags,
        postType: contentType
      });
      
    } catch (error) {
      console.warn(`Failed to group message ${message.id}:`, error);
    }
  }
  
  return Array.from(groups.values());
}

async function determineContentType(
  postId: string, 
  content: string, 
  hashtags: string[], 
  db: any
): Promise<'text' | 'image' | 'multimodal'> {
  try {
    // Check if post has associated media
    const mediaRecords = await db
      .select({ type: schema.media.type })
      .from(schema.media)
      .where(eq(schema.media.postId, postId))
      .all();

    const hasMedia = mediaRecords.length > 0;
    const hasImageMedia = mediaRecords.some(media => media.type === 'image');
    
    if (!hasMedia) {
      // No media attachments - pure text post
      return 'text';
    } else if (hasImageMedia && content.trim().length > 0) {
      // Has images AND text content - multimodal
      return 'multimodal';
    } else if (hasImageMedia) {
      // Has images but minimal/no text - image post
      return 'image';
    } else {
      // Has media but not images (video, etc.) - treat as multimodal for now
      return 'multimodal';
    }
  } catch (error) {
    console.warn(`Failed to determine content type for post ${postId}:`, error);
    // Fallback to text type for safety
    return 'text';
  }
}

async function processBatchGroup(group: BatchGroup, env: Bindings): Promise<ProcessingResult[]> {
  const startTime = Date.now();
  
  // Simplified processing for beta - using individual message processing
  const results = await Promise.allSettled(
    group.messages.map(msgData => processIndividualMessage(msgData, env))
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      success: false,
      messageId: group.messages[index].message.id,
      error: result.reason,
      processingTime: Date.now() - startTime,
      retryCount: 0
    };
  });
}

async function processIndividualMessage(
  msgData: { message: any; postId: string; content: string; hashtags: string[]; postType?: 'text' | 'image' | 'multimodal' },
  env: Bindings
): Promise<ProcessingResult> {
  const { message, postId, hashtags, postType } = msgData;
  const messageId = message.id;
  const startTime = Date.now();
  
  try {
    const db = createD1Client(env);
    
    // Get post details
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
      throw new Error(`Post or userId not found: ${postId}`);
    }
    
    // Determine post type if not provided (for backward compatibility)
    const effectivePostType = postType || await determineContentType(postId, post.content, hashtags, db);
    
    // Extract media data for image posts (for future enhancement)
    let mediaData = null;
    if (effectivePostType === 'image' || effectivePostType === 'multimodal') {
      try {
        const mediaRecords = await db
          .select({
            id: schema.media.id,
            type: schema.media.type,
            storageKey: schema.media.storageKey,
            order: schema.media.order,
          })
          .from(schema.media)
          .where(eq(schema.media.postId, postId))
          .orderBy(schema.media.order)
          .all();
        
        if (mediaRecords && mediaRecords.length > 0) {
          mediaData = {
            totalItems: mediaRecords.length,
            imageItems: mediaRecords.filter(m => m.type === 'image'),
            hasImages: mediaRecords.some(m => m.type === 'image'),
          };
        }
      } catch (error) {
        console.warn(`Failed to extract media data for post ${postId}:`, error);
      }
    }
    
    const vectorData = await generatePostEmbedding(
      postId,
      post.content,
      hashtags,
      env,
      post.userId,
      !!post.authorIsPrivate,
      effectivePostType,
      mediaData,
    );
    
    if (!vectorData || !Array.isArray(vectorData.vector) || vectorData.vector.length === 0) {
      throw new Error(`Failed to generate valid embedding vector for post ${postId}`);
    }
    
    await storePostEmbedding(vectorData, env.CAPTURE_KV);
    
    try {
      await env.USER_VECTOR_QUEUE.send({ userId: post.userId });
    } catch (queueError) {
      console.warn(`Failed to send userId ${post.userId} to USER_VECTOR_QUEUE:`, queueError);
    }
    
    message.ack();
    
    return {
      success: true,
      messageId,
      processingTime: Date.now() - startTime,
      retryCount: 0
    };
    
  } catch (error) {
    return {
      success: false,
      messageId,
      error: error instanceof Error ? error : new Error(String(error)),
      processingTime: Date.now() - startTime,
      retryCount: 0
    };
  }
}

async function handleBatchResults(
  results: PromiseSettledResult<ProcessingResult[]>[]
): Promise<void> {
  const logger = createLogger('handleBatchResults');
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const processingResult of result.value) {
        if (!processingResult.success) {
          await handleFailedMessage(processingResult);
        }
      }
    } else {
      logger.error('Batch group processing failed:', result.reason);
    }
  }
}

async function handleFailedMessage(result: ProcessingResult): Promise<void> {
  const logger = createLogger('handleFailedMessage');
  
  logger.error(`Failed to process message ${result.messageId}: ${result.error?.message}`);
  
  // Simplified retry logic for beta
  if (result.retryCount < RETRY_CONFIG.maxRetries) {
    const delay = calculateRetryDelay(result.retryCount);
    logger.info(`Will retry message ${result.messageId} after ${delay}ms delay`);
    // In a real implementation, you'd re-queue the message here
  } else {
    logger.warn(`Message ${result.messageId} failed after ${RETRY_CONFIG.maxRetries} retries`);
  }
}

// Simplified for beta - removed complex retry logic

function calculateRetryDelay(retryCount: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * RETRY_CONFIG.backoffMultiplier ** retryCount,
    RETRY_CONFIG.maxDelay
  );
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return delay + jitter;
}

async function fallbackIndividualProcessing(messages: any[], env: Bindings): Promise<void> {
  const logger = createLogger('fallbackIndividualProcessing');
  
  logger.warn('Falling back to individual message processing');
  
  const results = await Promise.allSettled(
    messages.map(async (message) => {
      const postId = message.body.postId;
      const messageId = message.id;
      
      try {
        const db = createD1Client(env);
        
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
        
        // Determine post type for fallback processing
        const postType = await determineContentType(postId, post.content, validHashtags, db);
        
        const vectorData = await generatePostEmbedding(
          postId,
          post.content,
          validHashtags,
          env,
          post.userId,
          !!post.authorIsPrivate,
          postType,
          null, // No media data in fallback processing for simplicity
        );
        
        if (!vectorData || !Array.isArray(vectorData.vector) || vectorData.vector.length === 0) {
          message.retry();
          return;
        }
        
        await storePostEmbedding(vectorData, env.CAPTURE_KV);
        
        try {
          await env.USER_VECTOR_QUEUE.send({ userId: post.userId });
        } catch (queueError) {
          console.warn(`Failed to send userId ${post.userId} to USER_VECTOR_QUEUE:`, queueError);
        }
        
        message.ack();
        
      } catch (error) {
        logger.error(`Failed to process message ${messageId}:`, error);
        message.retry();
      }
    })
  );
  
  const failed = results.filter(r => r.status === 'rejected').length;
  logger.info(`Fallback processing completed. ${failed} messages failed`);
}

// Enhanced User Embedding Queue Handler
export async function handleUserEmbeddingQueue(
  batch: MessageBatch<{ userId: string }>,
  env: Bindings,
): Promise<void> {
  const logger = createLogger('handleUserEmbeddingQueue');
  const startTime = Date.now();
  const POST_LIMIT = 20; // Consistent with interests endpoint
  
  logger.info(`Processing user embedding batch of ${batch.messages.length} messages`);
  
  try {
    // Process user embeddings with Promise.allSettled for better error handling
    const results = await Promise.allSettled(
      [...batch.messages].map(message => processUserEmbedding(message, env, POST_LIMIT))
    );
    
    // Handle results and any failures
    await handleUserEmbeddingResults(results, [...batch.messages]);
    
    const processingTime = Date.now() - startTime;
    processedCount += batch.messages.length;
    
    logger.info(`User embedding batch completed in ${processingTime}ms`);
    
    // Batch optimization removed for beta simplicity
    
  } catch (error) {
    logger.error('Critical error in user embedding batch processing:', error);
    // Fallback to individual processing
    await fallbackUserEmbeddingProcessing([...batch.messages], env, POST_LIMIT);
  }
}

async function processUserEmbedding(
  message: any,
  env: Bindings,
  POST_LIMIT: number
): Promise<ProcessingResult> {
  const userId = message.body.userId;
  const messageId = message.id;
  const startTime = Date.now();
  
  try {
    const db = createD1Client(env);
    const logger = createLogger('processUserEmbedding');
    
    logger.debug(`Processing user ${userId}`);
    
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
    const uniquePostIds = new Set([...savedPostIds, ...createdPostIds]);
    const allPostIds = Array.from(uniquePostIds);
    
    if (allPostIds.length === 0) {
      logger.debug(`No posts found for user ${userId}, storing null vector`);
      await env.CAPTURE_KV.delete(`vec:user:${userId}`);
      message.ack();
      return {
        success: true,
        messageId,
        processingTime: Date.now() - startTime,
        retryCount: 0
      };
    }
    
    // 3. Batch fetch vectors from KV for these posts
    const [savedVectors, createdVectors] = await Promise.all([
      fetchVectorsBatch(savedPostIds, env.CAPTURE_KV),
      fetchVectorsBatch(createdPostIds, env.CAPTURE_KV)
    ]);
    
    // 4. Get hashtag vectors for frequently used hashtags
    const hashtagVectors = await fetchHashtagVectors(allPostIds, db, env);
    
    // 5. Calculate average user vector using optimized WASM functions
    const userVector = await calculateOptimizedUserVector(savedVectors, createdVectors, hashtagVectors);
    
    if (!userVector) {
      logger.warn(`Failed to calculate user vector for ${userId}`);
      await env.CAPTURE_KV.delete(`vec:user:${userId}`);
      message.ack();
      return {
        success: true,
        messageId,
        processingTime: Date.now() - startTime,
        retryCount: 0
      };
    }
    
    // 6. Store user vector in KV
    await env.CAPTURE_KV.put(`vec:user:${userId}`, JSON.stringify(Array.from(userVector)));
    
    message.ack();
    
    return {
      success: true,
      messageId,
      processingTime: Date.now() - startTime,
      retryCount: 0
    };
    
  } catch (error) {
    // Still acknowledge the message to avoid infinite retries
    message.ack();
    return {
      success: false,
      messageId,
      error: error instanceof Error ? error : new Error(String(error)),
      processingTime: Date.now() - startTime,
      retryCount: 0
    };
  }
}

async function fetchVectorsBatch(
  postIds: string[],
  vectorStore: any,
): Promise<number[][]> {
  const vectors: number[][] = [];
  
  // Process vectors in batches to avoid overwhelming the KV store
  const batchSize = 10;
  for (let i = 0; i < postIds.length; i += batchSize) {
    const batch = postIds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (postId) => {
      try {
        const vectorData = await vectorStore.get(`vec:post:${postId}`, { type: 'json' }) as { vector: number[] } | null;
        return vectorData?.vector && Array.isArray(vectorData.vector) ? vectorData.vector : null;
      } catch (error) {
        console.warn(`Failed to get vector for post ${postId}:`, error);
        return null;
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        vectors.push(result.value);
      }
    }
  }
  
  return vectors;
}

async function fetchHashtagVectors(
  allPostIds: string[],
  db: any,
  env: Bindings,
): Promise<number[][]> {
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
    
    // Process hashtags in parallel
    const hashtagPromises = frequentHashtags.map(async (hashtag: { name: string; }) => {
      if (hashtag.name) {
        try {
          const hashtagVector = await generateEmbedding(hashtag.name, env);
          return hashtagVector && Array.isArray(hashtagVector) ? hashtagVector : null;
        } catch (error) {
          console.warn(`Failed to generate hashtag vector for ${hashtag.name}:`, error);
          return null;
        }
      }
      return null;
    });
    
    const hashtagResults = await Promise.allSettled(hashtagPromises);
    
    for (const result of hashtagResults) {
      if (result.status === 'fulfilled' && result.value) {
        hashtagVectors.push(result.value);
      }
    }
    
  } catch (error) {
    console.warn('Failed to process hashtags:', error);
  }
  
  return hashtagVectors;
}

async function calculateOptimizedUserVector(
  savedVectors: number[][],
  createdVectors: number[][],
  hashtagVectors: number[][] = []
): Promise<Float32Array | null> {
  // Use the existing calculateAverageVector function but with optimized WASM operations
  const userVector = calculateAverageVector(savedVectors, createdVectors, hashtagVectors);
  
  if (!userVector) {
    return null;
  }
  
  // Convert to Float32Array for WASM optimization
  const vectorArray = new Float32Array(userVector);
  
  // Apply WASM normalization if available
  try {
    const normalizedVector = await OptimizedVectorOps.batchNormalizeVectors(vectorArray);
    return normalizedVector;
  } catch (error) {
    console.warn('WASM normalization failed, using standard vector:', error);
    return vectorArray;
  }
}

async function handleUserEmbeddingResults(
  results: PromiseSettledResult<ProcessingResult>[],
  messages: any[]
): Promise<void> {
  const logger = createLogger('handleUserEmbeddingResults');
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const message = messages[i];
    
    if (result.status === 'fulfilled' && !result.value.success) {
      await handleFailedMessage(result.value);
    } else if (result.status === 'rejected') {
      logger.error(`User embedding processing failed for message ${message.id}:`, result.reason);
      
      const failedResult: ProcessingResult = {
        success: false,
        messageId: message.id,
        error: result.reason,
        processingTime: 0,
        retryCount: 0
      };
      
      await handleFailedMessage(failedResult);
    }
  }
}

async function fallbackUserEmbeddingProcessing(
  messages: any[],
  env: Bindings,
  POST_LIMIT: number
): Promise<void> {
  const logger = createLogger('fallbackUserEmbeddingProcessing');
  
  logger.warn('Falling back to individual user embedding processing');
  
  const results = await Promise.allSettled(
    messages.map(async (message) => {
      const userId = message.body.userId;
      
      try {
        const db = createD1Client(env);
        
        // Simplified processing similar to original implementation
        const savedPostsResult = await db
          .select({
            postId: schema.savedPost.postId,
            savedAt: schema.savedPost.createdAt,
          })
          .from(schema.savedPost)
          .where(eq(schema.savedPost.userId, userId))
          .orderBy(desc(schema.savedPost.createdAt))
          .limit(POST_LIMIT);
        
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
        const uniquePostIds = new Set([...savedPostIds, ...createdPostIds]);
        const allPostIds = Array.from(uniquePostIds);
        
        if (allPostIds.length === 0) {
          await env.CAPTURE_KV.delete(`vec:user:${userId}`);
          message.ack();
          return;
        }
        
        // Simplified vector calculation
        const savedVectors: number[][] = [];
        const createdVectors: number[][] = [];
        
        for (const postId of savedPostIds) {
          try {
            const vectorData = await env.CAPTURE_KV.get(`vec:post:${postId}`, { type: 'json' }) as { vector: number[] } | null;
            if (vectorData?.vector && Array.isArray(vectorData.vector)) {
              savedVectors.push(vectorData.vector);
            }
          } catch (error) {
            console.warn(`Failed to get vector for saved post ${postId}:`, error);
          }
        }
        
        for (const postId of createdPostIds) {
          try {
            const vectorData = await env.CAPTURE_KV.get(`vec:post:${postId}`, { type: 'json' }) as { vector: number[] } | null;
            if (vectorData?.vector && Array.isArray(vectorData.vector)) {
              createdVectors.push(vectorData.vector);
            }
          } catch (error) {
            console.warn(`Failed to get vector for created post ${postId}:`, error);
          }
        }
        
        const userVector = calculateAverageVector(savedVectors, createdVectors);
        
        if (!userVector) {
          await env.CAPTURE_KV.delete(`vec:user:${userId}`);
          message.ack();
          return;
        }
        
        await env.CAPTURE_KV.put(`vec:user:${userId}`, JSON.stringify(userVector));
        message.ack();
        
      } catch (error) {
        logger.error(`Failed to process user ${userId}:`, error);
        message.retry();
      }
    })
  );
  
  const failed = results.filter(r => r.status === 'rejected').length;
  logger.info(`Fallback user embedding processing completed. ${failed} messages failed`);
}

// Simplified monitoring for beta
export function getProcessedCount(): number {
  return processedCount;
}

export function resetProcessedCount(): void {
  processedCount = 0;
}

/**
 * Generate embedding for a post using the EmbeddingService
 */
async function generatePostEmbedding(
  postId: string,
  content: string,
  hashtags: string[],
  env: Bindings,
  userId: string,
  isPrivate: boolean,
  postType?: 'text' | 'image' | 'multimodal',
  mediaData?: any,
): Promise<{
  vector: number[];
  postId: string;
  userId: string;
  isPrivate: boolean;
  createdAt: string;
} | null> {
  try {
    const cachingService = createCachingService(env);
    const embeddingService = createEmbeddingService(env, cachingService);
    
    // Note: mediaData is extracted but not yet used in embedding generation
    // Future enhancement: incorporate image content directly into multimodal embeddings
    if (mediaData && (postType === 'image' || postType === 'multimodal')) {
      console.debug(`Post ${postId} has ${mediaData.totalItems} media items, ${mediaData.imageItems.length} images`);
    }
    
    // Generate embedding for post content + hashtags
    const result = await embeddingService.generatePostEmbedding(
      postId,
      content,
      hashtags,
      userId,
      isPrivate,
      'voyage',
      postType,
    );
    
    return {
      vector: result.embeddingResult.vector,
      postId,
      userId,
      isPrivate,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Failed to generate embedding for post ${postId}:`, error);
    return null;
  }
}

/**
 * Store post embedding in KV and optionally Qdrant
 */
async function storePostEmbedding(
  vectorData: {
    vector: number[];
    postId: string;
    userId: string;
    isPrivate: boolean;
    createdAt: string;
  },
  kvStore: any,
): Promise<void> {
  try {
    // Store in KV store for fast access
    await kvStore.put(`vec:post:${vectorData.postId}`, JSON.stringify(vectorData));
    
    // Optionally store in Qdrant for vector search (simplified for beta)
    // For now, we'll focus on KV storage only
    console.debug(`Stored embedding for post ${vectorData.postId} in KV store`);
  } catch (error) {
    console.error(`Failed to store embedding for post ${vectorData.postId}:`, error);
    throw error;
  }
}

/**
 * Simple wrapper for generating text embeddings
 */
async function generateEmbedding(text: string, env: Bindings): Promise<number[] | null> {
  try {
    const cachingService = createCachingService(env);
    const embeddingService = createEmbeddingService(env, cachingService);
    
    const result = await embeddingService.generateTextEmbedding(text);
    return result.vector;
  } catch (error) {
    console.error('Failed to generate embedding for text:', error);
    return null;
  }
}

// Enhanced logging utility
function createLogger(context: string) {
  return {
    info: (message: string, ...args: any[]) => 
      console.log(`[${context}] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => 
      console.warn(`[${context}] ${message}`, ...args),
    error: (message: string, ...args: any[]) => 
      console.error(`[${context}] ${message}`, ...args),
    debug: (message: string, ...args: any[]) => 
      console.debug(`[${context}] ${message}`, ...args),
  };
}
