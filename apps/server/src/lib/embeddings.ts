import type { Ai } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';

// Interface for vector operations
export interface VectorData {
  postId?: string;
  userId?: string;
  vector: number[];
  text: string;
  createdAt: string;
}

/**
 * Generate an embedding vector for the given text
 */
export async function generateEmbedding(text: string, ai: Ai, retries = 2): Promise<number[]> {
  try {
    const result = await ai.run('@cf/baai/bge-base-en-v1.5', { text });

    // Extract the vector data from the response
    if (result && result.data && Array.isArray(result.data[0])) {
      return result.data[0];
    }

    throw new Error('Invalid embedding response format');
  } catch (error) {
    if (retries > 0) {
      console.warn(`Embedding generation failed, retrying (${retries} retries left)`, error);
      // Wait a short time before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
      return generateEmbedding(text, ai, retries - 1);
    }

    console.error('Embedding generation failed after retries', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate an embedding for post content
 */
export async function generatePostEmbedding(
  postId: string,
  content: string,
  hashtags: string[] = [],
  ai: Ai,
): Promise<VectorData> {
  // Combine post content with hashtags for better semantic representation
  const text = content + (hashtags.length > 0 ? ' ' + hashtags.join(' ') : '');

  const vector = await generateEmbedding(text, ai);

  return {
    postId,
    vector,
    text,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate a user interest embedding based on their activity
 */
export async function generateUserEmbedding(
  userId: string,
  interests: string[],
  ai: Ai,
): Promise<VectorData> {
  const text = `User interests: ${interests.join(', ')}`;

  const vector = await generateEmbedding(text, ai);

  return {
    userId,
    vector,
    text,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Store post embedding in KV
 */
export async function storePostEmbedding(vectorData: VectorData, kv: KVNamespace): Promise<void> {
  if (!vectorData.postId) {
    throw new Error('Post ID is required for storing post embeddings');
  }

  await kv.put(`post:${vectorData.postId}`, JSON.stringify(vectorData));
}

/**
 * Store user embedding in KV
 */
export async function storeUserEmbedding(vectorData: VectorData, kv: KVNamespace): Promise<void> {
  if (!vectorData.userId) {
    throw new Error('User ID is required for storing user embeddings');
  }

  await kv.put(`user:${vectorData.userId}`, JSON.stringify(vectorData));
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

// Keep the original handler for direct API access
const handler = {
  async fetch(request: Request, env: any): Promise<Response> {
    try {
      if (request.method === 'POST') {
        const body = await request.json();

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
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

export default handler;
