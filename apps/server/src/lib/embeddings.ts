import type { Ai } from '@cloudflare/workers-types';

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
  vectorize: VectorizeIndex,
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

    // Structure payload and log it
    const payload = {
      id: `post:${vectorData.postId}`,
      values: vectorData.vector,
      metadata: {
        type: 'post',
        postId: vectorData.postId,
        text: vectorData.text,
        createdAt: vectorData.createdAt,
      },
    };

    // Debug log before upsert
    console.debug(
      `[storePostEmbedding] Upserting vector id=${payload.id}, length=${payload.values.length}`,
    );
    await vectorize.upsert([payload]);
  } catch (error) {
    console.error('Failed to store vector in Vectorize:', error);
    // Log more details about the error
    if (error.response) {
      console.error('Vectorize API response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    }
    throw new Error(`Vectorize storage failed: ${error.message}`);
  }
}

const handler = {
  async fetch(request: Request, env: any): Promise<Response> {
    try {
      if (request.method === 'POST') {
        interface EmbeddingRequestBody {
          text: string;
        }

        const body = (await request.json()) as EmbeddingRequestBody;

        if (!body.text) {
          return new Response(JSON.stringify({ error: 'Text is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const vector = await generateEmbedding(body.text, env.AI);

        return new Response(JSON.stringify({ vector }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      let message = 'Unknown error';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'string') {
        message = error;
      }
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

export default handler;
