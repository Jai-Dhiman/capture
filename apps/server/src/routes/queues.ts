import { createD1Client } from '@/db';
import * as schema from '@/db/schema';
import type { Bindings } from '@/types';
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

const MONITORING_CONFIG = {
  slowOperationThreshold: 30000, // 30 seconds
  deadLetterRetryLimit: 5,
};

interface QueueMetrics {
  processed: number;
  failed: number;
  retried: number;
  avgProcessingTime: number;
  slowOperations: number;
  deadLetterCount: number;
}

interface ProcessingResult {
  success: boolean;
  messageId: string;
  error?: Error;
  processingTime: number;
  retryCount: number;
}

interface BatchGroup {
  contentType: string;
  messages: Array<{
    message: any;
    postId: string;
    content: string;
    hashtags: string[];
  }>;
}

let queueMetrics: QueueMetrics = {
  processed: 0,
  failed: 0,
  retried: 0,
  avgProcessingTime: 0,
  slowOperations: 0,
  deadLetterCount: 0,
};

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
    const batchGroups = await groupMessagesByContentType(batch.messages, env);
    
    // Process each group using Promise.allSettled for better error handling
    const groupResults = await Promise.allSettled(
      batchGroups.map(group => processBatchGroup(group, env))
    );
    
    // Process individual results and handle any failures
    await handleBatchResults(groupResults, batch.messages, env);
    
    const processingTime = Date.now() - startTime;
    updateQueueMetrics(batch.messages.length, processingTime);
    
    logger.info(`Batch processing completed in ${processingTime}ms`);
    
    // Check for slow operations
    if (processingTime > MONITORING_CONFIG.slowOperationThreshold) {
      queueMetrics.slowOperations++;
      logger.warn(`Slow batch processing detected: ${processingTime}ms`);
    }
    
  } catch (error) {
    logger.error('Critical error in batch processing:', error);
    // Fallback to individual processing
    await fallbackIndividualProcessing(batch.messages, env);
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
      const contentType = determineContentType(post.content, validHashtags);
      
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
        hashtags: validHashtags
      });
      
    } catch (error) {
      console.warn(`Failed to group message ${message.id}:`, error);
    }
  }
  
  return Array.from(groups.values());
}

function determineContentType(content: string, hashtags: string[]): string {
  // Simple content type determination - could be enhanced with ML classification
  if (hashtags.length > 5) return 'hashtag-heavy';
  if (content.length > 500) return 'long-form';
  if (content.includes('http')) return 'link-content';
  return 'standard';
}

async function processBatchGroup(group: BatchGroup, env: Bindings): Promise<ProcessingResult[]> {
  const logger = createLogger('processBatchGroup');
  const startTime = Date.now();
  
  // Simplified processing for beta - using individual message processing
  const results = await Promise.allSettled(
    group.messages.map(msgData => processIndividualMessage(msgData, env))
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        messageId: group.messages[index].message.id,
        error: result.reason,
        processingTime: Date.now() - startTime,
        retryCount: 0
      };
    }
  });
}

// Removed batch embedding functions - simplified for beta

function determinePriority(contentType: string): 'high' | 'medium' | 'low' {
  switch (contentType) {
    case 'hashtag-heavy':
      return 'high'; // Hashtag-heavy content needs faster processing
    case 'long-form':
      return 'medium'; // Long-form content has moderate priority
    case 'link-content':
      return 'low'; // Link content can be processed slower
    default:
      return 'medium';
  }
}

async function processIndividualMessage(
  msgData: { message: any; postId: string; content: string; hashtags: string[] },
  env: Bindings
): Promise<ProcessingResult> {
  const { message, postId, content, hashtags } = msgData;
  const messageId = message.id;
  const startTime = Date.now();
  
  try {
    const db = createD1Client(env);
    const qdrantClient = new QdrantClient(env);
    
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
    
    const vectorData = await generatePostEmbedding(
      postId,
      post.content,
      hashtags,
      env,
      post.userId,
      !!post.authorIsPrivate,
    );
    
    if (!vectorData || !Array.isArray(vectorData.vector) || vectorData.vector.length === 0) {
      throw new Error(`Failed to generate valid embedding vector for post ${postId}`);
    }
    
    await storePostEmbedding(vectorData, env.POST_VECTORS, qdrantClient);
    
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
  results: PromiseSettledResult<ProcessingResult[]>[],
  messages: any[],
  env: Bindings
): Promise<void> {
  const logger = createLogger('handleBatchResults');
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const processingResult of result.value) {
        if (!processingResult.success) {
          await handleFailedMessage(processingResult, env);
        }
      }
    } else {
      logger.error('Batch group processing failed:', result.reason);
    }
  }
}

async function handleFailedMessage(result: ProcessingResult, env: Bindings): Promise<void> {
  const logger = createLogger('handleFailedMessage');
  
  queueMetrics.failed++;
  
  // Implement exponential backoff retry logic
  const shouldRetry = await shouldRetryMessage(result, env);
  
  if (shouldRetry) {
    queueMetrics.retried++;
    const delay = calculateRetryDelay(result.retryCount);
    
    logger.info(`Retrying message ${result.messageId} after ${delay}ms delay`);
    
    // Schedule retry (simplified - in production, use proper scheduling)
    setTimeout(async () => {
      // Retry logic would go here
      logger.info(`Retrying message ${result.messageId}`);
    }, delay);
  } else {
    // Send to dead letter queue
    await sendToDeadLetterQueue(result, env);
  }
}

async function shouldRetryMessage(result: ProcessingResult, env: Bindings): Promise<boolean> {
  if (result.retryCount >= RETRY_CONFIG.maxRetries) {
    return false;
  }
  
  // Check if error is retryable
  const isRetryableError = result.error && (
    result.error.message.includes('timeout') ||
    result.error.message.includes('network') ||
    result.error.message.includes('temporary')
  );
  
  return isRetryableError;
}

function calculateRetryDelay(retryCount: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
    RETRY_CONFIG.maxDelay
  );
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return delay + jitter;
}

async function sendToDeadLetterQueue(result: ProcessingResult, env: Bindings): Promise<void> {
  const logger = createLogger('sendToDeadLetterQueue');
  
  try {
    queueMetrics.deadLetterCount++;
    
    // Store in dead letter queue (using KV for simplicity)
    await env.DEAD_LETTER_QUEUE.put(
      `failed:${result.messageId}:${Date.now()}`,
      JSON.stringify({
        messageId: result.messageId,
        error: result.error?.message || 'Unknown error',
        retryCount: result.retryCount,
        timestamp: Date.now(),
        processingTime: result.processingTime
      })
    );
    
    logger.warn(`Message ${result.messageId} sent to dead letter queue`);
  } catch (error) {
    logger.error(`Failed to send message ${result.messageId} to dead letter queue:`, error);
  }
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
        const qdrantClient = new QdrantClient(env);
        
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
        
        const vectorData = await generatePostEmbedding(
          postId,
          post.content,
          validHashtags,
          env,
          post.userId,
          !!post.authorIsPrivate,
        );
        
        if (!vectorData || !Array.isArray(vectorData.vector) || vectorData.vector.length === 0) {
          message.retry();
          return;
        }
        
        await storePostEmbedding(vectorData, env.POST_VECTORS, qdrantClient);
        
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

function updateQueueMetrics(processedCount: number, processingTime: number): void {
  queueMetrics.processed += processedCount;
  queueMetrics.avgProcessingTime = 
    (queueMetrics.avgProcessingTime + processingTime) / 2;
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
      batch.messages.map(message => processUserEmbedding(message, env, POST_LIMIT))
    );
    
    // Handle results and any failures
    await handleUserEmbeddingResults(results, batch.messages, env);
    
    const processingTime = Date.now() - startTime;
    updateQueueMetrics(batch.messages.length, processingTime);
    
    logger.info(`User embedding batch completed in ${processingTime}ms`);
    
    // Apply batch optimization for user vectors
    await optimizeUserVectorBatch(batch.messages, env);
    
  } catch (error) {
    logger.error('Critical error in user embedding batch processing:', error);
    // Fallback to individual processing
    await fallbackUserEmbeddingProcessing(batch.messages, env, POST_LIMIT);
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
    const allPostIds = [...new Set([...savedPostIds, ...createdPostIds])];
    
    if (allPostIds.length === 0) {
      logger.debug(`No posts found for user ${userId}, storing null vector`);
      await env.USER_VECTORS.delete(userId);
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
      fetchVectorsBatch(savedPostIds, env.POST_VECTORS, messageId),
      fetchVectorsBatch(createdPostIds, env.POST_VECTORS, messageId)
    ]);
    
    // 4. Get hashtag vectors for frequently used hashtags
    const hashtagVectors = await fetchHashtagVectors(allPostIds, db, env, messageId);
    
    // 5. Calculate average user vector using optimized WASM functions
    const userVector = await calculateOptimizedUserVector(savedVectors, createdVectors, hashtagVectors);
    
    if (!userVector) {
      logger.warn(`Failed to calculate user vector for ${userId}`);
      await env.USER_VECTORS.delete(userId);
      message.ack();
      return {
        success: true,
        messageId,
        processingTime: Date.now() - startTime,
        retryCount: 0
      };
    }
    
    // 6. Store user vector in KV
    await env.USER_VECTORS.put(userId, JSON.stringify(Array.from(userVector)));
    
    logger.debug(
      `Successfully updated user vector for ${userId} using ${savedVectors.length} saved, ${createdVectors.length} created, ${hashtagVectors.length} hashtag vectors`
    );
    
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

async function fetchVectorsBatch(
  postIds: string[],
  vectorStore: any,
  messageId: string
): Promise<number[][]> {
  const vectors: number[][] = [];
  
  // Process vectors in batches to avoid overwhelming the KV store
  const batchSize = 10;
  for (let i = 0; i < postIds.length; i += batchSize) {
    const batch = postIds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (postId) => {
      try {
        const vectorData = await vectorStore.get<{ vector: number[] }>(`post:${postId}`, {
          type: 'json',
        });
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
  messageId: string
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
    const hashtagPromises = frequentHashtags.map(async (hashtag) => {
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
    console.warn(`Failed to process hashtags:`, error);
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
  messages: any[],
  env: Bindings
): Promise<void> {
  const logger = createLogger('handleUserEmbeddingResults');
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const message = messages[i];
    
    if (result.status === 'fulfilled' && !result.value.success) {
      await handleFailedMessage(result.value, env);
    } else if (result.status === 'rejected') {
      logger.error(`User embedding processing failed for message ${message.id}:`, result.reason);
      
      const failedResult: ProcessingResult = {
        success: false,
        messageId: message.id,
        error: result.reason,
        processingTime: 0,
        retryCount: 0
      };
      
      await handleFailedMessage(failedResult, env);
    }
  }
}

async function optimizeUserVectorBatch(messages: any[], env: Bindings): Promise<void> {
  try {
    if (messages.length <= 1) return;
    
    const logger = createLogger('optimizeUserVectorBatch');
    logger.info(`Optimizing batch of ${messages.length} user vectors`);
    
    // Fetch all user vectors for batch processing
    const userVectors: Float32Array[] = [];
    const userIds: string[] = [];
    
    for (const message of messages) {
      const userId = message.body.userId;
      try {
        const vectorData = await env.USER_VECTORS.get(userId);
        if (vectorData) {
          const vector = JSON.parse(vectorData);
          if (Array.isArray(vector)) {
            userVectors.push(new Float32Array(vector));
            userIds.push(userId);
          }
        }
      } catch (error) {
        console.warn(`Failed to get user vector for ${userId}:`, error);
      }
    }
    
    if (userVectors.length > 1) {
      // Apply batch diversity scoring
      const combinedVectors = new Float32Array(userVectors.length * 1024);
      userVectors.forEach((vector, index) => {
        combinedVectors.set(vector, index * 1024);
      });
      
      const diversityScores = await OptimizedVectorOps.computeDiversityScores(combinedVectors);
      
      // Store diversity scores for future use
      for (let i = 0; i < userIds.length; i++) {
        await env.USER_VECTOR_METRICS.put(
          `diversity:${userIds[i]}`,
          JSON.stringify({ score: diversityScores[i], timestamp: Date.now() })
        );
      }
    }
    
  } catch (error) {
    console.warn('User vector batch optimization failed:', error);
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
      const messageId = message.id;
      
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
        const allPostIds = [...new Set([...savedPostIds, ...createdPostIds])];
        
        if (allPostIds.length === 0) {
          await env.USER_VECTORS.delete(userId);
          message.ack();
          return;
        }
        
        // Simplified vector calculation
        const savedVectors: number[][] = [];
        const createdVectors: number[][] = [];
        
        for (const postId of savedPostIds) {
          try {
            const vectorData = await env.POST_VECTORS.get<{ vector: number[] }>(`post:${postId}`, {
              type: 'json',
            });
            if (vectorData?.vector && Array.isArray(vectorData.vector)) {
              savedVectors.push(vectorData.vector);
            }
          } catch (error) {
            console.warn(`Failed to get vector for saved post ${postId}:`, error);
          }
        }
        
        for (const postId of createdPostIds) {
          try {
            const vectorData = await env.POST_VECTORS.get<{ vector: number[] }>(`post:${postId}`, {
              type: 'json',
            });
            if (vectorData?.vector && Array.isArray(vectorData.vector)) {
              createdVectors.push(vectorData.vector);
            }
          } catch (error) {
            console.warn(`Failed to get vector for created post ${postId}:`, error);
          }
        }
        
        const userVector = calculateAverageVector(savedVectors, createdVectors);
        
        if (!userVector) {
          await env.USER_VECTORS.delete(userId);
          message.ack();
          return;
        }
        
        await env.USER_VECTORS.put(userId, JSON.stringify(userVector));
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

// Queue Monitoring and Alerting Functions
export function getQueueMetrics(): QueueMetrics {
  return { ...queueMetrics };
}

export function resetQueueMetrics(): void {
  queueMetrics = {
    processed: 0,
    failed: 0,
    retried: 0,
    avgProcessingTime: 0,
    slowOperations: 0,
    deadLetterCount: 0,
  };
}

export async function monitorQueueHealth(env: Bindings): Promise<{
  isHealthy: boolean;
  metrics: QueueMetrics;
  alerts: string[];
}> {
  const alerts: string[] = [];
  
  // Check failure rate
  const failureRate = queueMetrics.processed > 0 ? 
    queueMetrics.failed / queueMetrics.processed : 0;
  
  if (failureRate > 0.1) { // 10% failure rate threshold
    alerts.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
  }
  
  // Check processing time
  if (queueMetrics.avgProcessingTime > MONITORING_CONFIG.slowOperationThreshold) {
    alerts.push(`Slow processing time: ${queueMetrics.avgProcessingTime}ms`);
  }
  
  // Check dead letter queue
  if (queueMetrics.deadLetterCount > 100) {
    alerts.push(`High dead letter count: ${queueMetrics.deadLetterCount}`);
  }
  
  // Check retry rate
  const retryRate = queueMetrics.processed > 0 ?
    queueMetrics.retried / queueMetrics.processed : 0;
    
  if (retryRate > 0.2) { // 20% retry rate threshold
    alerts.push(`High retry rate: ${(retryRate * 100).toFixed(2)}%`);
  }
  
  return {
    isHealthy: alerts.length === 0,
    metrics: queueMetrics,
    alerts
  };
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
