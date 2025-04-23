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

    console.error('Embedding generation failed after retries', error);
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

export async function storeUserEmbedding(
  vectorData: VectorData,
  kv: KVNamespace,
  vectorize: VectorizeIndex,
): Promise<void> {
  if (!vectorData.userId) {
    throw new Error('User ID is required for storing user embeddings');
  }

  await kv.put(`user:${vectorData.userId}`, JSON.stringify(vectorData));

  try {
    await vectorize.upsert([
      {
        id: `user:${vectorData.userId}`,
        values: vectorData.vector,
        metadata: {
          type: 'user',
          userId: vectorData.userId,
          text: vectorData.text,
          createdAt: vectorData.createdAt,
        },
      },
    ]);
  } catch (error) {
    console.error('Failed to store vector in Vectorize:', error);
    throw new Error(`Vectorize storage failed: ${error.message}`);
  }
}

export async function findSimilarPosts(
  queryVector: number[],
  vectorize: VectorizeIndex,
  limit: number,
  minScore: 0.7,
): Promise<SimilarityResult[]> {
  try {
    const response = await vectorize.query(queryVector, {
      topK: limit * 2,
      filter: { type: 'post' },
    });

    let matches = [];
    if (response && Array.isArray(response.matches)) {
      matches = response.matches;
    } else if (response && Array.isArray(response)) {
      matches = response;
    } else if (response && typeof response === 'object') {
      const responseObj = response as Record<string, any>;
      const arrayProps = Object.keys(responseObj).filter((key) => Array.isArray(responseObj[key]));
      if (arrayProps.length > 0) {
        matches = responseObj[arrayProps[0]];
      }
    }

    if (!Array.isArray(matches)) {
      console.error('Unexpected Vectorize response format:', response);
      return [];
    }

    const results: SimilarityResult[] = [];
    for (const match of matches) {
      if (match && typeof match.score === 'number' && match.score >= minScore) {
        results.push({
          id: match.id.replace('post:', ''),
          score: match.score,
          vector: match.values || [],
          isPostId: true,
          metadata: match.metadata || {},
        });

        if (results.length >= limit) break;
      }
    }

    return results;
  } catch (error) {
    console.error('Error finding similar posts:', error);
    throw new Error(`Similarity search failed: ${error.message}`);
  }
}

export async function findSimilarUsers(
  queryVector: number[],
  vectorize: VectorizeIndex,
  limit: 10,
  minScore: 0.7,
): Promise<SimilarityResult[]> {
  try {
    const response = await vectorize.query(queryVector, {
      topK: limit * 2,
      filter: { type: 'user' },
    });

    let matches = [];
    if (response && Array.isArray(response.matches)) {
      matches = response.matches;
    } else if (response && Array.isArray(response)) {
      matches = response;
    } else if (response && typeof response === 'object') {
      const responseObj = response as Record<string, any>;
      const arrayProps = Object.keys(responseObj).filter((key) => Array.isArray(responseObj[key]));
      if (arrayProps.length > 0) {
        matches = responseObj[arrayProps[0]];
      }
    }

    if (!Array.isArray(matches)) {
      console.error('Unexpected Vectorize response format:', response);
      return [];
    }

    const results: SimilarityResult[] = [];
    for (const match of matches) {
      if (match && typeof match.score === 'number' && match.score >= minScore) {
        results.push({
          id: match.id.replace('user:', ''),
          score: match.score,
          vector: match.values || [],
          isPostId: false,
          metadata: match.metadata || {},
        });

        if (results.length >= limit) break;
      }
    }

    return results;
  } catch (error) {
    console.error('Error finding similar users:', error);
    throw new Error(`Similarity search failed: ${error.message}`);
  }
}

export async function getPostVector(postId: string, kv: KVNamespace): Promise<VectorData | null> {
  const data = await kv.get(`post:${postId}`);
  return data ? JSON.parse(data) : null;
}

export async function getUserVector(userId: string, kv: KVNamespace): Promise<VectorData | null> {
  const data = await kv.get(`user:${userId}`);
  return data ? JSON.parse(data) : null;
}

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
