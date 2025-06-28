import type { Ai } from '@cloudflare/workers-types';
import type { QdrantClient } from './qdrantClient';

export interface VectorData {
  postId?: string;
  userId?: string;
  vector: number[];
  text: string;
  createdAt: string;
}

interface PostMetadata {
  type: 'post';
  postId: string;
  text: string;
  createdAt: string;
}

interface UserMetadata {
  type: 'user';
  userId: string;
  text: string;
  createdAt: string;
}

export interface SimilarityResult {
  id: string;
  score: number;
  vector: number[];
  isPostId?: boolean;
  metadata?: PostMetadata | UserMetadata;
}

export async function generateEmbedding(text: string, ai: Ai, retries = 2): Promise<number[]> {
  try {
    const result = await ai.run('@cf/baai/bge-base-en-v1.5', { text });

    if (Array.isArray(result?.data?.[0])) {
      return result.data[0];
    }

    throw new Error('Invalid embedding response format');
  } catch (error) {
    if (retries > 0) {
      console.warn(`Embedding generation failed, retrying (${retries} retries left)`, error);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return generateEmbedding(text, ai, retries - 1);
    }

    console.error('[generateEmbedding] Embedding generation failed after retries', error);
    let errorMessage = 'An unknown error occurred during embedding generation';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(`Failed to generate embedding: ${errorMessage}`);
  }
}

export async function generatePostEmbedding(
  postId: string,
  content: string,
  hashtags: string[],
  ai: Ai,
): Promise<VectorData> {
  const text = content + (hashtags.length > 0 ? ` ${hashtags.join(' ')}` : '');

  const vector = await generateEmbedding(text, ai);

  return {
    postId,
    vector,
    text,
    createdAt: new Date().toISOString(),
  };
}

export async function storePostEmbedding(
  vectorData: VectorData,
  kv: KVNamespace,
  qdrantClient: QdrantClient,
): Promise<void> {
  if (!vectorData.postId) {
    throw new Error('Post ID is required for storing post embeddings');
  }

  const kvKey = `post:${vectorData.postId}`;
  await kv.put(kvKey, JSON.stringify(vectorData));

  try {
    // Check vector data validity
    if (!Array.isArray(vectorData.vector) || vectorData.vector.length === 0) {
      throw new Error('Invalid vector data: empty or not an array');
    }

    // Check for invalid values
    const hasInvalidValues = vectorData.vector.some(
      (val) => Number.isNaN(val) || !Number.isFinite(val),
    );

    if (hasInvalidValues) {
      throw new Error('Vector contains NaN or infinite values');
    }

    // Validate expected embedding dimension
    const EXPECTED_DIMENSION = 768;
    if (vectorData.vector.length !== EXPECTED_DIMENSION) {
      console.error(
        `[storePostEmbedding] Invalid embedding length: expected ${EXPECTED_DIMENSION}, got ${vectorData.vector.length}`,
      );
      throw new Error(
        `Embedding length ${vectorData.vector.length} does not match expected ${EXPECTED_DIMENSION}`,
      );
    }

    // Store in Qdrant
    await qdrantClient.upsertVector({
      id: `post:${vectorData.postId}`,
      vector: vectorData.vector,
      payload: {
        post_id: vectorData.postId,
        text: vectorData.text,
        created_at: vectorData.createdAt,
        content_type: 'text',
      },
    });

    console.debug(`[storePostEmbedding] Successfully stored vector for post ${vectorData.postId}`);
  } catch (error) {
    console.error('Failed to store vector in Qdrant:', error);
    // Log more details about the error
    if (error && typeof error === 'object' && 'response' in error) {
      const errorWithResponse = error as {
        response: { status: number; statusText: string; data: any };
      };
      console.error('Qdrant API response:', {
        status: errorWithResponse.response.status,
        statusText: errorWithResponse.response.statusText,
        data: errorWithResponse.response.data,
      });
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Qdrant storage failed: ${errorMessage}`);
  }
}


