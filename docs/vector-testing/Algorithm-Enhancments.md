# Capture: Vector Database Migration & Recommendation System Enhancement

## Overview

This document outlines the migration from Cloudflare Vectorize to Qdrant and implementation of enhanced recommendation features for the Capture social media platform. The enhancements focus on multi-modal content understanding and improved relevance scoring while maintaining privacy-first principles.

## Table of Contents

1. [Phase 1: Qdrant Migration](#phase-1-qdrant-migration)
2. [Phase 2: Multi-Modal Embeddings](#phase-2-multi-modal-embeddings)
3. [Phase 3: Enhanced Scoring System](#phase-3-enhanced-scoring-system)
4. [Phase 4: Integration & Testing](#phase-4-integration--testing)
5. [Implementation Timeline](#implementation-timeline)

---

## Phase 1: Qdrant Migration

### 1.1 Infrastructure Setup

#### Local Development Setup (Docker)

For local development and testing, you can run Qdrant using Docker:

**Prerequisites:**
- Docker Desktop installed and running
- Terminal access

**Step-by-step Setup:**

1. **Start Qdrant Container:**
```bash
# Run Qdrant with persistent storage
docker run -d --name qdrant -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

2. **Verify Installation:**
```bash
# Check if container is running
docker ps

# Test Qdrant connection
curl http://localhost:6333/
```

3. **Access Points:**
- **API Endpoint**: `http://localhost:6333`
- **Web Dashboard**: `http://localhost:6333/dashboard`
- **Data Storage**: `./qdrant_storage/` (persistent)

**Useful Docker Commands:**
```bash
# Stop Qdrant
docker stop qdrant

# Start Qdrant
docker start qdrant

# View logs
docker logs qdrant

# Remove container (keeps data)
docker rm -f qdrant

# Fresh restart (removes data)
docker rm -f qdrant && rm -rf qdrant_storage
```

**Local Environment Variables:**
```typescript
// For development/testing
const QDRANT_URL = "http://localhost:6333";
const QDRANT_API_KEY = ""; // No API key needed for local
const QDRANT_COLLECTION_NAME = "posts";
```

### 1.2 Qdrant Collection Schema

```typescript
// Collection configuration
interface QdrantCollectionConfig {
  collection_name: "posts";
  vectors: {
    size: 768;  // BGE embedding dimension
    distance: "Cosine";
  };
  payload_schema: {
    post_id: "keyword";
    user_id: "keyword";
    content_type: "keyword"; // "text", "image", "video", "mixed"
    created_at: "datetime";
    hashtags: "keyword[]";
    is_private: "bool";
  };
}
```

**Important Note**: Qdrant point IDs must be either integers or UUIDs, not arbitrary strings.

### 1.3 Qdrant Client Implementation

```typescript
// apps/server/src/lib/qdrantClient.ts
export class QdrantClient {
  private baseUrl: string;
  private apiKey: string;
  private collectionName: string;

  constructor(env: Bindings) {
    this.baseUrl = env.QDRANT_URL;
    this.apiKey = env.QDRANT_API_KEY;
    this.collectionName = env.QDRANT_COLLECTION_NAME || 'posts';
  }

  async upsertVector(data: {
    id: string;
    vector: number[];
    payload: Record<string, any>;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points`, {
      method: 'PUT',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        points: [{
          id: data.id,
          vector: data.vector,
          payload: data.payload,
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant upsert failed: ${response.statusText}`);
    }
  }

  async searchVectors(params: {
    vector: number[];
    limit: number;
    filter?: Record<string, any>;
    with_payload?: boolean;
  }): Promise<QdrantSearchResult[]> {
    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points/search`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: params.vector,
        limit: params.limit,
        filter: params.filter,
        with_payload: params.with_payload || true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant search failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.result;
  }

  async deleteVector(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points/delete`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        points: [id],
      }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant delete failed: ${response.statusText}`);
    }
  }
}

interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}
```

### 1.4 Migration from Vectorize

```typescript
// apps/server/src/lib/embeddings.ts - Updated functions

export async function storePostEmbedding(
  vectorData: VectorData,
  kv: KVNamespace,
  qdrantClient: QdrantClient, // Replace vectorize parameter
): Promise<void> {
  if (!vectorData.postId) {
    throw new Error('Post ID is required for storing post embeddings');
  }

  // Store in KV for backward compatibility
  const kvKey = `post:${vectorData.postId}`;
  await kv.put(kvKey, JSON.stringify(vectorData));

  // Store in Qdrant
  try {
    const payload = {
      post_id: vectorData.postId,
      text: vectorData.text,
      created_at: vectorData.createdAt,
      content_type: 'text', // Will be enhanced in Phase 2
    };

    await qdrantClient.upsertVector({
      id: `post:${vectorData.postId}`,
      vector: vectorData.vector,
      payload,
    });

    console.debug(`[storePostEmbedding] Successfully stored vector for post ${vectorData.postId}`);
  } catch (error) {
    console.error('Failed to store vector in Qdrant:', error);
    throw new Error(`Qdrant storage failed: ${error.message}`);
  }
}
```

### 1.5 Update Discovery Resolver

```typescript
// apps/server/src/graphql/resolvers/discovery.ts - Key changes

export const discoveryResolvers = {
  Query: {
    discoverFeed: async (
      _: unknown,
      { limit = 10, cursor }: { limit?: number; cursor?: string },
      context: ContextType,
    ): Promise<GraphQLFeedPayload> => {
      const { user, env } = context;
      const qdrantClient = new QdrantClient(env);

      // ... existing user vector retrieval ...

      // Replace Vectorize query with Qdrant
      let vectorMatches: QdrantSearchResult[] = [];
      const vectorQueryLimit = limit * 10;
      
      try {
        vectorMatches = await qdrantClient.searchVectors({
          vector: userVector,
          limit: vectorQueryLimit,
          filter: {
            // Add privacy filtering at vector level
            should: [
              { key: "is_private", match: { value: false } },
              { key: "user_id", match: { value: userId } } // Own posts
            ]
          }
        });
      } catch (e) {
        console.error(`Qdrant query failed for user ${userId}:`, e);
        throw new Error('Failed to query recommendations');
      }

      // Extract post IDs and scores
      const recommendedPostIds = vectorMatches.map(match => 
        match.id.startsWith('post:') ? match.id.slice(5) : match.id
      );
      const similarityScoreMap = new Map(
        vectorMatches.map(match => [
          match.id.startsWith('post:') ? match.id.slice(5) : match.id,
          match.score,
        ])
      );

      // ... rest of the function remains similar ...
    },
  },
};
```

---

## Phase 2: Multi-Modal Embeddings

### 2.1 Enhanced Embedding Generation

```typescript
// apps/server/src/lib/embeddings.ts - New multi-modal functions

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  storageKey: string;
}

export async function generateMultiModalEmbedding(
  postId: string,
  content: string,
  hashtags: string[],
  media: MediaItem[],
  ai: Ai,
  bucket: R2Bucket,
): Promise<VectorData> {
  // Generate text embedding
  const textContent = content + (hashtags.length > 0 ? ` ${hashtags.join(' ')}` : '');
  const textEmbedding = await generateEmbedding(textContent, ai);

  let finalEmbedding = textEmbedding;
  let contentType = 'text';

  if (media.length > 0) {
    try {
      const visualEmbeddings = await Promise.all(
        media.map(async (item) => {
          try {
            const mediaBuffer = await fetchMediaFromR2(item.storageKey, bucket);
            
            if (item.type === 'image') {
              const result = await ai.run('@cf/openai/clip-vit-base-patch32', {
                image: Array.from(new Uint8Array(mediaBuffer))
              });
              return result.data?.[0];
            } else if (item.type === 'video') {
              // For video, extract first frame or use video-specific model
              // This is a placeholder - implement based on available models
              const result = await ai.run('@cf/meta/video-to-text', {
                video: Array.from(new Uint8Array(mediaBuffer))
              });
              return await generateEmbedding(result.description || '', ai);
            }
          } catch (error) {
            console.warn(`Failed to process media ${item.id}:`, error);
            return null;
          }
          return null;
        })
      );

      const validVisualEmbeddings = visualEmbeddings.filter(Boolean);

      if (validVisualEmbeddings.length > 0) {
        finalEmbedding = combineEmbeddings(textEmbedding, validVisualEmbeddings);
        contentType = media.length === 1 ? media[0].type : 'mixed';
      }
    } catch (error) {
      console.warn(`Visual processing failed for post ${postId}, using text-only:`, error);
    }
  }

  return {
    postId,
    vector: finalEmbedding,
    text: textContent,
    contentType,
    createdAt: new Date().toISOString(),
  };
}

function combineEmbeddings(textEmb: number[], visualEmbs: number[][]): number[] {
  const textWeight = 0.7;
  const visualWeight = 0.3 / visualEmbs.length;
  
  const combined = textEmb.map(val => val * textWeight);
  
  visualEmbs.forEach(visualEmb => {
    if (visualEmb && visualEmb.length === textEmb.length) {
      visualEmb.forEach((val, idx) => {
        combined[idx] += val * visualWeight;
      });
    }
  });
  
  return combined;
}

async function fetchMediaFromR2(storageKey: string, bucket: R2Bucket): Promise<ArrayBuffer> {
  const object = await bucket.get(storageKey);
  if (!object) {
    throw new Error(`Media not found: ${storageKey}`);
  }
  return await object.arrayBuffer();
}
```

### 2.2 Update Queue Processing

```typescript
// apps/server/src/routes/queues.ts - Enhanced post processing

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
        // Fetch post with media
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
          console.error(`[handlePostQueue][${messageId}] Post not found: ${postId}`);
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
          .then((rows) => rows.map((r) => r.name).filter(Boolean));

        // Fetch media
        const media = await db
          .select({
            id: schema.media.id,
            type: schema.media.type,
            storageKey: schema.media.storageKey,
          })
          .from(schema.media)
          .where(eq(schema.media.postId, postId))
          .all();

        // Generate multi-modal embedding
        const vectorData = await generateMultiModalEmbedding(
          postId,
          post.content,
          hashtags,
          media as MediaItem[],
          env.AI,
          env.BUCKET
        );

        if (!vectorData?.vector?.length) {
          console.error(`[handlePostQueue][${messageId}] Invalid embedding for ${postId}`);
          message.retry();
          return;
        }

        // Store in both KV and Qdrant
        await storePostEmbedding(vectorData, env.POST_VECTORS, qdrantClient);

        // Trigger user vector update
        await env.USER_VECTOR_QUEUE.send({ userId: post.userId });

        message.ack();
      } catch (error) {
        console.error(`[handlePostQueue][${messageId}] Failed to process ${postId}:`, error);
        message.retry();
      }
    })();

    promises.push(processingPromise);
  }

  await Promise.all(promises);
}
```

---

## Phase 3: Enhanced Scoring System

### 3.1 New Scoring Functions

```typescript
// apps/server/src/lib/recommendation.ts - Complete rewrite

interface ContentSignals {
  similarity: number;
  engagementRate: number;
  contentType: 'text' | 'image' | 'video' | 'mixed';
  authorRelevance: number;
  temporalRelevance: number;
  diversityBonus: number;
}

interface UserContext {
  naturalContentPreferences: Record<string, number>;
  recentTopics: Set<string>;
  followingPatterns: {
    closeConnections: string[];
    recentInteractions: string[];
  };
}

export function computeEnhancedScore(
  signals: ContentSignals,
  userContext: UserContext
): number {
  const {
    similarity,
    engagementRate,
    contentType,
    authorRelevance,
    temporalRelevance,
    diversityBonus
  } = signals;

  // Base relevance (primary factor)
  let score = similarity * 0.4;

  // Quality signals (normalized engagement)
  score += normalizeEngagement(engagementRate) * 0.25;

  // Social relevance (following patterns)
  score += authorRelevance * 0.2;

  // Content type preference (natural consumption patterns)
  score += getContentTypeAffinity(contentType, userContext) * 0.1;

  // Temporal relevance (fresh content preference)
  score += temporalRelevance * 0.03;

  // Diversity bonus (exploration)
  score += diversityBonus * 0.02;

  return Math.min(score, 1.0);
}

export function normalizeEngagement(rawEngagement: number): number {
  // Logarithmic normalization to prevent viral content domination
  return Math.log(rawEngagement + 1) / Math.log(100);
}

export function getContentTypeAffinity(
  contentType: string,
  userContext: UserContext
): number {
  const preferences = userContext.naturalContentPreferences;
  return preferences[contentType] || 0.5; // Neutral default
}

export function calculateTemporalRelevance(createdAt: string): number {
  const postAge = Date.now() - new Date(createdAt).getTime();
  const hoursAge = postAge / (1000 * 60 * 60);

  // Gentle recency preference (not addiction-focused)
  if (hoursAge < 6) return 1.0;   // Very recent
  if (hoursAge < 24) return 0.8;  // Today
  if (hoursAge < 168) return 0.6; // This week
  if (hoursAge < 720) return 0.3; // This month
  return 0.1; // Older content
}

export function calculateEngagementRate(
  saveCount: number,
  commentCount: number,
  createdAt: string
): number {
  const totalEngagement = (saveCount || 0) + (commentCount || 0);
  const postAge = Date.now() - new Date(createdAt).getTime();
  const hoursAge = Math.max(postAge / (1000 * 60 * 60), 1);

  const ratePerHour = totalEngagement / hoursAge;
  return Math.min(ratePerHour / 10, 1); // Normalized rate
}

export async function calculateAuthorRelevance(
  postUserId: string,
  currentUserId: string,
  followedUserIds: string[],
  db: any
): Promise<number> {
  // Direct following
  if (followedUserIds.includes(postUserId)) {
    return 0.8;
  }

  // Mutual connections (privacy-preserving)
  try {
    const mutualConnections = await db
      .select({ count: sql`COUNT(*)` })
      .from(schema.relationship)
      .where(
        and(
          eq(schema.relationship.followedId, postUserId),
          inArray(schema.relationship.followerId, followedUserIds)
        )
      )
      .get();

    const mutualCount = mutualConnections?.count || 0;
    return Math.min(mutualCount * 0.1, 0.6);
  } catch (error) {
    console.warn('Failed to calculate mutual connections:', error);
    return 0;
  }
}

export function calculateDiversityBonus(
  postTopics: string[],
  userRecentTopics: Set<string>
): number {
  const hasNewTopic = postTopics.some(topic => 
    !userRecentTopics.has(topic.toLowerCase())
  );
  return hasNewTopic ? 0.1 : 0;
}

export function extractTopicsFromPost(
  content: string,
  hashtags: string[]
): string[] {
  // Extract hashtags
  const hashtagTopics = hashtags.map(tag => tag.toLowerCase());
  
  // Simple keyword extraction (can be enhanced with NLP)
  const contentWords = content.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 10); // Limit to prevent noise

  return [...hashtagTopics, ...contentWords];
}
```

### 3.2 User Context Building

```typescript
// apps/server/src/lib/userContext.ts

export async function buildUserContext(
  userId: string,
  db: any
): Promise<UserContext> {
  // Get user's natural content preferences from interaction history
  const recentInteractions = await db
    .select({
      postId: schema.savedPost.postId,
      createdAt: schema.savedPost.createdAt,
    })
    .from(schema.savedPost)
    .where(eq(schema.savedPost.userId, userId))
    .orderBy(desc(schema.savedPost.createdAt))
    .limit(50)
    .all();

  // Analyze content type preferences
  const contentTypeStats = new Map<string, number>();
  const recentTopics = new Set<string>();

  for (const interaction of recentInteractions) {
    // Get post details
    const post = await db
      .select({
        content: schema.post.content,
      })
      .from(schema.post)
      .where(eq(schema.post.id, interaction.postId))
      .get();

    if (!post) continue;

    // Get media for content type
    const hasMedia = await db
      .select({ type: schema.media.type })
      .from(schema.media)
      .where(eq(schema.media.postId, interaction.postId))
      .limit(1)
      .get();

    const contentType = hasMedia ? hasMedia.type : 'text';
    contentTypeStats.set(contentType, (contentTypeStats.get(contentType) || 0) + 1);

    // Extract topics
    const hashtags = await db
      .select({ name: schema.hashtag.name })
      .from(schema.postHashtag)
      .leftJoin(schema.hashtag, eq(schema.hashtag.id, schema.postHashtag.hashtagId))
      .where(eq(schema.postHashtag.postId, interaction.postId))
      .all();

    const topics = extractTopicsFromPost(
      post.content,
      hashtags.map(h => h.name).filter(Boolean)
    );
    
    topics.forEach(topic => recentTopics.add(topic));
  }

  // Normalize content type preferences
  const totalInteractions = recentInteractions.length || 1;
  const naturalContentPreferences: Record<string, number> = {};
  
  for (const [type, count] of contentTypeStats) {
    naturalContentPreferences[type] = count / totalInteractions;
  }

  // Get following patterns
  const followingRelations = await db
    .select({
      followedId: schema.relationship.followedId,
      createdAt: schema.relationship.createdAt,
    })
    .from(schema.relationship)
    .where(eq(schema.relationship.followerId, userId))
    .all();

  const closeConnections = followingRelations
    .filter(rel => {
      const followSince = Date.now() - new Date(rel.createdAt).getTime();
      return followSince > 30 * 24 * 60 * 60 * 1000; // Following for 30+ days
    })
    .map(rel => rel.followedId);

  return {
    naturalContentPreferences,
    recentTopics,
    followingPatterns: {
      closeConnections,
      recentInteractions: recentInteractions.map(i => i.postId),
    },
  };
}
```

---

## Phase 4: Integration & Testing

### 4.1 Updated Discovery Resolver

```typescript
// apps/server/src/graphql/resolvers/discovery.ts - Final integrated version

import { buildUserContext, computeEnhancedScore, calculateAuthorRelevance, calculateDiversityBonus, extractTopicsFromPost } from '../../lib/recommendation';
import { QdrantClient } from '../../lib/qdrantClient';

export const discoveryResolvers = {
  Query: {
    discoverFeed: async (
      _: unknown,
      { limit = 10, cursor }: { limit?: number; cursor?: string },
      context: ContextType,
    ): Promise<GraphQLFeedPayload> => {
      const { user, env } = context;
      const db = createD1Client(env);
      const qdrantClient = new QdrantClient(env);
      const userId = user.id;

      // Build user context for enhanced scoring
      const userContext = await buildUserContext(userId, db);

      // Get user vector
      let userVector: number[] | null = null;
      try {
        userVector = await env.USER_VECTORS.get<number[]>(userId, { type: 'json' });
      } catch (e) {
        console.error(`Failed to get user vector for ${userId}:`, e);
        return { posts: [], nextCursor: null };
      }

      if (!userVector) {
        return { posts: [], nextCursor: null };
      }

      // Vector search with Qdrant
      let vectorMatches: QdrantSearchResult[] = [];
      try {
        vectorMatches = await qdrantClient.searchVectors({
          vector: userVector,
          limit: limit * 10,
          with_payload: true,
        });
      } catch (e) {
        console.error(`Qdrant search failed for user ${userId}:`, e);
        throw new Error('Failed to query recommendations');
      }

      if (vectorMatches.length === 0) {
        return { posts: [], nextCursor: null };
      }

      // Get recommended post IDs and similarity scores
      const recommendedPostIds = vectorMatches.map(match => 
        match.id.startsWith('post:') ? match.id.slice(5) : match.id
      );
      const similarityScoreMap = new Map(
        vectorMatches.map(match => [
          match.id.startsWith('post:') ? match.id.slice(5) : match.id,
          match.score,
        ])
      );

      // Fetch post details from D1
      const recommendedPosts = await db
        .select({
          id: schema.post.id,
          userId: schema.post.userId,
          content: schema.post.content,
          type: schema.post.type,
          createdAt: schema.post.createdAt,
          _saveCount: schema.post._saveCount,
          _commentCount: schema.post._commentCount,
          author: schema.profile,
        })
        .from(schema.post)
        .innerJoin(schema.profile, eq(schema.post.userId, schema.profile.userId))
        .where(inArray(schema.post.id, recommendedPostIds))
        .orderBy(desc(schema.post.createdAt));

      // Get user relationships for filtering and scoring
      const [followedUsersResult, blockedUsersResult] = await Promise.all([
        db
          .select({ followedId: schema.relationship.followedId })
          .from(schema.relationship)
          .where(eq(schema.relationship.followerId, userId)),
        db
          .select({ blockedId: schema.blockedUser.blockedId })
          .from(schema.blockedUser)
          .where(eq(schema.blockedUser.blockerId, userId)),
      ]);

      const followedUserIds = followedUsersResult.map(r => r.followedId);
      const blockedUserIds = blockedUsersResult.map(r => r.blockedId);

      // Apply filters
      const filteredPosts = recommendedPosts.filter(post => {
        // Block filter
        if (blockedUserIds.includes(post.userId)) return false;
        
        // Privacy filter
        const isPrivate = !!post.author.isPrivate;
        if (isPrivate && post.userId !== userId && !followedUserIds.includes(post.userId)) {
          return false;
        }
        
        return true;
      });

      // Enhanced scoring and ranking
      const enhancedPosts = await Promise.all(
        filteredPosts.map(async (post) => {
          const similarity = similarityScoreMap.get(post.id) ?? 0;
          
          // Calculate enhanced signals
          const authorRelevance = await calculateAuthorRelevance(
            post.userId,
            userId,
            followedUserIds,
            db
          );

          const temporalRelevance = calculateTemporalRelevance(post.createdAt);
          const engagementRate = calculateEngagementRate(
            post._saveCount || 0,
            post._commentCount || 0,
            post.createdAt
          );

          // Get hashtags for diversity calculation
          const hashtags = await db
            .select({ name: schema.hashtag.name })
            .from(schema.postHashtag)
            .leftJoin(schema.hashtag, eq(schema.hashtag.id, schema.postHashtag.hashtagId))
            .where(eq(schema.postHashtag.postId, post.id))
            .all();

          const postTopics = extractTopicsFromPost(
            post.content,
            hashtags.map(h => h.name).filter(Boolean)
          );

          const diversityBonus = calculateDiversityBonus(postTopics, userContext.recentTopics);

          // Determine content type
          const media = await db
            .select({ type: schema.media.type })
            .from(schema.media)
            .where(eq(schema.media.postId, post.id))
            .limit(1)
            .get();

          const contentType = media ? media.type : 'text';

          // Calculate enhanced score
          const enhancedScore = computeEnhancedScore({
            similarity,
            engagementRate,
            contentType: contentType as any,
            authorRelevance,
            temporalRelevance,
            diversityBonus,
          }, userContext);

          return {
            ...post,
            _enhancedScore: enhancedScore,
          };
        })
      );

      // Final ranking
      const rankedPosts = enhancedPosts.sort((a, b) => {
        // Priority for recent posts from followed users
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const aIsRecentFollowed = followedUserIds.includes(a.userId) && 
          new Date(a.createdAt).getTime() >= oneWeekAgo;
        const bIsRecentFollowed = followedUserIds.includes(b.userId) && 
          new Date(b.createdAt).getTime() >= oneWeekAgo;

        if (aIsRecentFollowed && !bIsRecentFollowed) return -1;
        if (!aIsRecentFollowed && bIsRecentFollowed) return 1;

        return b._enhancedScore - a._enhancedScore;
      });

      // Pagination
      const startIndex = cursor
        ? Math.max(rankedPosts.findIndex(p => p.id === cursor) + 1, 0)
        : 0;
      const finalPosts = rankedPosts.slice(startIndex, startIndex + limit);
      const nextCursor = finalPosts.length === limit && startIndex + limit < rankedPosts.length
        ? finalPosts[finalPosts.length - 1].id
        : null;

      // Format response
      const formattedPosts: GraphQLPost[] = await Promise.all(
        finalPosts.map(async (p) => {
          const media = await db
            .select({
              id: schema.media.id,
              type: schema.media.type,
              storageKey: schema.media.storageKey,
              order: schema.media.order,
              createdAt: schema.media.createdAt,
            })
            .from(schema.media)
            .where(eq(schema.media.postId, p.id))
            .orderBy(schema.media.order);

          return {
            id: p.id,
            userId: p.userId,
            content: p.content,
            type: p.type as GraphQLPostType,
            createdAt: p.createdAt,
            updatedAt: p.createdAt,
            _saveCount: p._saveCount,
            _commentCount: p._commentCount,
            user: {
              id: p.author.id,
              userId: p.author.userId,
              username: p.author.username,
              profileImage: p.author.profileImage,
              verifiedType: p.author.verifiedType ?? 'none',
              isPrivate: !!p.author.isPrivate,
            },
            media,
          };
        })
      );

      return {
        posts: formattedPosts,
        nextCursor,
      };
    },
  },
};
```

### 4.2 Environment Setup

```toml
# wrangler.toml additions
[vars]
QDRANT_URL = "https://your-cluster.qdrant.io"
QDRANT_COLLECTION_NAME = "posts"

[[kv_namespaces]]
binding = "POST_VECTORS"
id = "your-post-vectors-kv-id"
preview_id = "your-post-vectors-preview-id"

[[kv_namespaces]]
binding = "USER_VECTORS" 
id = "your-user-vectors-kv-id"
preview_id = "your-user-vectors-preview-id"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "capture-media"
preview_bucket_name = "capture-media-preview"

[vars.production]
QDRANT_API_KEY = "your-production-api-key"

[vars.preview]
QDRANT_API_KEY = "your-preview-api-key"
```

---

## Implementation Timeline

### Week 1-2: Qdrant Migration
- [ ] Set up Qdrant infrastructure
- [ ] Implement QdrantClient
- [ ] Create collection with proper schema
- [ ] Update embeddings.ts to use Qdrant
- [ ] Migrate existing vectors (if any)
- [ ] Update discovery resolver to use Qdrant
- [ ] Test basic functionality

### Week 3-4: Multi-Modal Embeddings
- [ ] Implement generateMultiModalEmbedding
- [ ] Add media fetching from R2
- [ ] Update queue processing for media
- [ ] Test image embedding generation
- [ ] Test video processing (if available)
- [ ] Performance optimization

### Week 5-6: Enhanced Scoring
- [ ] Implement new scoring functions
- [ ] Create user context building
- [ ] Update discovery resolver with enhanced scoring
- [ ] Add content type affinity calculation
- [ ] Implement diversity bonuses
- [ ] Test and tune scoring weights

### Week 7: Integration & Testing
- [ ] End-to-end testing
- [ ] Performance benchmarking
- [ ] User acceptance testing
- [ ] Monitoring and logging
- [ ] Documentation updates
- [ ] Deployment to production

### Ongoing: Monitoring & Optimization
- [ ] Monitor Qdrant performance
- [ ] Track recommendation quality metrics
- [ ] A/B test scoring parameters
- [ ] Optimize embedding generation costs
- [ ] Scale vector database as needed

---

## Success Metrics

1. **Technical Performance**
   - Vector search latency < 100ms
   - Embedding generation success rate > 95%
   - Multi-modal content properly processed

2. **Recommendation Quality**
   - User engagement with recommended content
   - Diversity of recommended content types
   - Reduced filter bubble effects

3. **Privacy Compliance**
   - No individual user behavior tracking
   - Transparent recommendation explanations
   - User control over recommendation parameters

This implementation maintains Capture's privacy-first principles while significantly enhancing content discovery capabilities through better understanding of both text and visual content.
