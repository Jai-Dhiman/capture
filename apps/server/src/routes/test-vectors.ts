import { Hono } from 'hono';
import { createD1Client } from '../db';
import * as schema from '../db/schema';
import { generateEmbedding, generatePostEmbedding, storePostEmbedding } from '../lib/embeddings';
import { QdrantClient } from '../lib/qdrantClient';
import type { Bindings, Variables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { eq } from 'drizzle-orm';

const testVectorsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Test basic embedding generation
testVectorsRouter.get('/test-embedding', authMiddleware, async (c) => {
  try {
    const testText = "This is a test post about technology and programming";
    const vector = await generateEmbedding(testText, c.env.AI);
    
    return c.json({
      success: true,
      message: "Embedding generated successfully",
      vectorLength: vector.length,
      sampleValues: vector.slice(0, 5), // First 5 values
    });
  } catch (error) {
    console.error('Test embedding failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Test Qdrant connection
testVectorsRouter.get('/test-qdrant', authMiddleware, async (c) => {
  try {
    const qdrantClient = new QdrantClient(c.env);
    
    // Test basic connection by ensuring collection exists
    await qdrantClient.ensureCollection();
    
    return c.json({
      success: true,
      message: "Qdrant connection successful, collection ensured",
      config: {
        url: c.env.QDRANT_URL,
        collection: c.env.QDRANT_COLLECTION_NAME || 'posts',
        hasApiKey: !!c.env.QDRANT_API_KEY,
      }
    });
  } catch (error) {
    console.error('Qdrant test failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Test full post embedding pipeline
testVectorsRouter.post('/test-post-vector', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { postId } = body;
    
    if (!postId) {
      return c.json({ error: 'postId is required' }, 400);
    }

    const db = createD1Client(c.env);
    const qdrantClient = new QdrantClient(c.env);

    // Get post details
    const post = await db
      .select({
        id: schema.post.id,
        content: schema.post.content,
        userId: schema.post.userId,
      })
      .from(schema.post)
      .where(eq(schema.post.id, postId))
      .get();

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Get hashtags
    const hashtags = await db
      .select({ name: schema.hashtag.name })
      .from(schema.postHashtag)
      .where(eq(schema.postHashtag.postId, postId))
      .leftJoin(schema.hashtag, eq(schema.hashtag.id, schema.postHashtag.hashtagId))
      .all()
      .then((rows) => rows.map((r) => r.name).filter((name): name is string => name !== null));

    // Generate embedding
    const vectorData = await generatePostEmbedding(postId, post.content, hashtags, c.env.AI);

    // Store in KV and Qdrant
    await storePostEmbedding(vectorData, c.env.POST_VECTORS, qdrantClient);

    // Verify storage in KV
    const storedInKV = await c.env.POST_VECTORS.get(`post:${postId}`);
    
    // Test Qdrant search
    const searchResult = await qdrantClient.searchVectors({
      vector: vectorData.vector,
      limit: 1,
    });

    return c.json({
      success: true,
      message: "Post vector generated and stored successfully",
      postId,
      postContent: post.content,
      hashtags,
      vectorLength: vectorData.vector.length,
      storedInKV: !!storedInKV,
      qdrantSearchResult: searchResult.length > 0,
    });
  } catch (error) {
    console.error('Test post vector failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Test user vector generation
testVectorsRouter.post('/test-user-vector', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;

    // Check current user vector
    const currentVector = await c.env.USER_VECTORS.get(userId);
    
    // Manually trigger user vector queue
    await c.env.USER_VECTOR_QUEUE.send({ userId });

    return c.json({
      success: true,
      message: "User vector queue triggered",
      userId,
      hadExistingVector: !!currentVector,
      queueTriggered: true,
    });
  } catch (error) {
    console.error('Test user vector failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Test queue processing manually
testVectorsRouter.post('/test-queue', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { postId } = body;
    
    if (!postId) {
      return c.json({ error: 'postId is required' }, 400);
    }

    // Trigger post queue
    await c.env.POST_QUEUE.send({ postId });

    return c.json({
      success: true,
      message: "Post queue triggered",
      postId,
    });
  } catch (error) {
    console.error('Test queue failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default testVectorsRouter; 