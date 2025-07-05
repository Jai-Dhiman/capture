import type { Bindings } from '../types';

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

export interface CollectionConfig {
  name: string;
  dimensions: number;
  distance?: 'Cosine' | 'Euclidean' | 'Dot';
}

export class QdrantClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultCollectionName: string;

  constructor(env: Bindings) {
    this.baseUrl = env.QDRANT_URL || 'http://localhost:6333';
    this.apiKey = env.QDRANT_API_KEY || '';
    this.defaultCollectionName = env.QDRANT_COLLECTION_NAME || 'posts';
  }

  async ensureCollection(collectionConfig?: CollectionConfig): Promise<void> {
    const config = collectionConfig || {
      name: this.defaultCollectionName,
      dimensions: 1024, // Voyage embedding dimension (default)
      distance: 'Cosine',
    };

    try {
      // Check if collection exists
      const response = await fetch(`${this.baseUrl}/collections/${config.name}`, {
        method: 'GET',
        headers: {
          'Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        // Collection doesn't exist, create it
        const createResponse = await fetch(`${this.baseUrl}/collections/${config.name}`, {
          method: 'PUT',
          headers: {
            'Api-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vectors: {
              size: config.dimensions,
              distance: config.distance || 'Cosine',
            },
          }),
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create collection: ${createResponse.statusText}`);
        }
      } else if (!response.ok) {
        throw new Error(`Failed to check collection: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to ensure collection exists:', error);
      throw error;
    }
  }

  async upsertVector(data: {
    id: string;
    vector: number[];
    payload: Record<string, any>;
    collectionConfig?: CollectionConfig;
  }): Promise<void> {
    const config = data.collectionConfig || {
      name: this.defaultCollectionName,
      dimensions: 768,
      distance: 'Cosine',
    };

    await this.ensureCollection(config);

    // Convert string ID to UUID format if needed
    const pointId = this.convertToValidId(data.id);

    const response = await fetch(`${this.baseUrl}/collections/${config.name}/points`, {
      method: 'PUT',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        points: [
          {
            id: pointId,
            vector: data.vector,
            payload: {
              ...data.payload,
              original_id: data.id, // Store original ID in payload
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qdrant upsert failed: ${response.statusText} - ${errorText}`);
    }
  }

  async searchVectors(params: {
    vector: number[];
    limit: number;
    filter?: Record<string, any>;
    with_payload?: boolean;
    collectionConfig?: CollectionConfig;
  }): Promise<QdrantSearchResult[]> {
    const config = params.collectionConfig || {
      name: this.defaultCollectionName,
      dimensions: 768,
      distance: 'Cosine',
    };

    await this.ensureCollection(config);

    const response = await fetch(`${this.baseUrl}/collections/${config.name}/points/search`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: params.vector,
        limit: params.limit,
        filter: params.filter,
        with_payload: params.with_payload !== false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qdrant search failed: ${response.statusText} - ${errorText}`);
    }

    const result = (await response.json()) as {
      result: Array<{ id: number; score: number; payload?: Record<string, any> }>;
    };

    // Convert back to original format with original IDs
    return result.result.map((point) => ({
      id: point.payload?.original_id || point.id.toString(),
      score: point.score,
      payload: point.payload || {},
    }));
  }

  async deleteVector(id: string, collectionConfig?: CollectionConfig): Promise<void> {
    const config = collectionConfig || {
      name: this.defaultCollectionName,
      dimensions: 768,
      distance: 'Cosine',
    };

    await this.ensureCollection(config);

    const pointId = this.convertToValidId(id);

    const response = await fetch(`${this.baseUrl}/collections/${config.name}/points/delete`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        points: [pointId],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qdrant delete failed: ${response.statusText} - ${errorText}`);
    }
  }

  // Convenience methods used by recommendation engine

  async searchSimilar(
    vector: Float32Array | number[],
    limit: number,
    options: {
      excludeUserId?: string;
      minScore?: number;
      collectionConfig?: CollectionConfig;
    } = {},
  ): Promise<Array<{ id: string; score: number; vector: number[]; metadata: any }>> {
    const vectorArray = Array.isArray(vector) ? vector : Array.from(vector);

    const filter = options.excludeUserId
      ? {
          must_not: [{ key: 'userId', match: { value: options.excludeUserId } }],
        }
      : undefined;

    const results = await this.searchVectors({
      vector: vectorArray,
      limit,
      filter,
      with_payload: true,
      collectionConfig: options.collectionConfig,
    });

    return results
      .filter((result) => !options.minScore || result.score >= options.minScore)
      .map((result) => ({
        id: result.id,
        score: result.score,
        vector: vectorArray, // Would need to fetch actual vector if needed
        metadata: result.payload,
      }));
  }

  async searchPosts(options: {
    excludeUserId?: string;
    limit: number;
    includeEmbedding?: boolean;
    includeMetadata?: boolean;
    collectionConfig?: CollectionConfig;
  }): Promise<{ posts: any[] }> {
    // Use scroll to get posts without needing a query vector
    const filter = options.excludeUserId
      ? {
          must_not: [{ key: 'userId', match: { value: options.excludeUserId } }],
        }
      : undefined;

    const results = await this.scroll({
      limit: options.limit,
      filter,
      with_payload: options.includeMetadata !== false,
      collectionConfig: options.collectionConfig,
    });

    const posts = results.map((result) => ({
      id: result.id,
      userId: result.payload?.userId,
      content: result.payload?.content || '',
      createdAt: result.payload?.createdAt || new Date().toISOString(),
      saveCount: result.payload?.saveCount || 0,
      commentCount: result.payload?.commentCount || 0,
      viewCount: result.payload?.viewCount || 0,
      hashtags: result.payload?.hashtags || [],
      contentType: result.payload?.contentType || 'text',
      isPrivate: result.payload?.isPrivate || false,
      embeddingVector: options.includeEmbedding ? result.vector : undefined,
    }));

    return { posts };
  }

  async searchByMetadata(options: {
    filter: Record<string, any>;
    limit: number;
    includeEmbedding?: boolean;
    collectionConfig?: CollectionConfig;
  }): Promise<Array<{ id: string; metadata: any; vector?: number[] }>> {
    const results = await this.scroll({
      limit: options.limit,
      filter: options.filter,
      with_payload: true,
      collectionConfig: options.collectionConfig,
    });

    return results.map((result) => ({
      id: result.id,
      metadata: result.payload,
      vector: options.includeEmbedding ? result.vector : undefined,
    }));
  }

  async scroll(options: {
    limit: number;
    filter?: Record<string, any>;
    with_payload?: boolean;
    collectionConfig?: CollectionConfig;
  }): Promise<Array<{ id: string; payload: any; vector?: number[] }>> {
    const config = options.collectionConfig || {
      name: this.defaultCollectionName,
      dimensions: 768,
      distance: 'Cosine',
    };

    await this.ensureCollection(config);

    const response = await fetch(`${this.baseUrl}/collections/${config.name}/points/scroll`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: options.limit,
        filter: options.filter,
        with_payload: options.with_payload !== false,
        with_vector: true, // Always include vector for now
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qdrant scroll failed: ${response.statusText} - ${errorText}`);
    }

    const result = (await response.json()) as {
      result: {
        points: Array<{
          id: number;
          payload?: Record<string, any>;
          vector?: number[];
        }>;
      };
    };

    return result.result.points.map((point) => ({
      id: point.payload?.original_id || point.id.toString(),
      payload: point.payload || {},
      vector: point.vector,
    }));
  }

  private convertToValidId(id: string): number {
    // Convert string ID to a consistent integer using hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
