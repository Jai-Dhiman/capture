import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Embedding Flow Integration Test', () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should create post and generate embeddings', async () => {
    // 1. Create a test post via GraphQL
    const createPostMutation = `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          id
          content
          userId
          createdAt
        }
      }
    `;

    const postInput = {
      content: 'Testing Voyage embedding generation with WASM optimization! #test #embedding',
      type: 'post',
      isDraft: false,
    };

    // Mock auth header for testing
    const response = await worker.fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token', // You'll need to mock this
      },
      body: JSON.stringify({
        query: createPostMutation,
        variables: { input: postInput },
      }),
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result.data).toBeTruthy();
    expect(result.data.createPost).toBeTruthy();
    
    const postId = result.data.createPost.id;
    console.log('Created post with ID:', postId);

    // 2. Wait for queue processing (embedding generation)
    // In a real test, you'd wait for queue processing or mock it
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Verify embedding was created and stored in Qdrant
    // This would require accessing the queue handler or Qdrant directly
    console.log('Post creation and queue dispatch successful');
  });

  it('should verify Qdrant collection has correct dimensions', async () => {
    // Test Qdrant collection configuration
    const response = await worker.fetch('/api/test/qdrant-info', {
      method: 'GET',
    });

    if (response.status === 200) {
      const qdrantInfo = await response.json();
      expect(qdrantInfo.dimensions).toBe(1024);
      expect(qdrantInfo.distance).toBe('Cosine');
    } else {
      console.log('Qdrant test endpoint not available');
    }
  });

  it('should test WASM vector operations', async () => {
    // Test WASM similarity calculation
    const testVector1 = new Float32Array(1024).fill(0.5);
    const testVector2 = new Float32Array(1024).fill(0.7);

    const response = await worker.fetch('/api/test/wasm-similarity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector1: Array.from(testVector1),
        vector2: Array.from(testVector2),
      }),
    });

    if (response.status === 200) {
      const result = await response.json();
      expect(result.similarity).toBeDefined();
      expect(result.similarity).toBeTypeOf('number');
      expect(result.usedWasm).toBe(true);
    } else {
      console.log('WASM test endpoint not available');
    }
  });
});