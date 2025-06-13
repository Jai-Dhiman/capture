import type { Bindings } from '../types';

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

export class QdrantClient {
  private baseUrl: string;
  private apiKey: string;
  private collectionName: string;

  constructor(env: Bindings) {
    this.baseUrl = env.QDRANT_URL || 'http://localhost:6333';
    this.apiKey = env.QDRANT_API_KEY || '';
    this.collectionName = env.QDRANT_COLLECTION_NAME || 'posts';
  }

  async ensureCollection(): Promise<void> {
    try {
      // Check if collection exists
      const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}`, {
        method: 'GET',
        headers: {
          'Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        // Collection doesn't exist, create it
        const createResponse = await fetch(`${this.baseUrl}/collections/${this.collectionName}`, {
          method: 'PUT',
          headers: {
            'Api-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vectors: {
              size: 768, // BGE embedding dimension
              distance: 'Cosine',
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
  }): Promise<void> {
    await this.ensureCollection();

    // Convert string ID to UUID format if needed
    const pointId = this.convertToValidId(data.id);

    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points`, {
      method: 'PUT',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        points: [{
          id: pointId,
          vector: data.vector,
          payload: {
            ...data.payload,
            original_id: data.id, // Store original ID in payload
          },
        }],
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
  }): Promise<QdrantSearchResult[]> {
    await this.ensureCollection();

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
        with_payload: params.with_payload !== false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qdrant search failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json() as { result: Array<{ id: number; score: number; payload?: Record<string, any> }> };
    
    // Convert back to original format with original IDs
    return result.result.map((point) => ({
      id: point.payload?.original_id || point.id.toString(),
      score: point.score,
      payload: point.payload || {},
    }));
  }

  async deleteVector(id: string): Promise<void> {
    await this.ensureCollection();

    const pointId = this.convertToValidId(id);

    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points/delete`, {
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

  private convertToValidId(id: string): number {
    // Convert string ID to a consistent integer using hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
} 