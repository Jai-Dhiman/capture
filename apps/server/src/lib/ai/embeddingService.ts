import type { Bindings } from '@/types';
import type { CachingService } from '../cache/cachingService';
import { CacheTTL } from '../cache/cachingService';
import type { QdrantClient, CollectionConfig } from '../infrastructure/qdrantClient';

export type EmbeddingProvider = 'voyage';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  collectionName: string;
  dimensions: number;
  distance?: 'Cosine' | 'Euclidean' | 'Dot';
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  provider: EmbeddingProvider;
  collectionConfig: CollectionConfig;
}

export interface MultimodalInput {
  type: 'text' | 'image';
  content: string;
}

export interface VoyageTextRequest {
  input: string | string[];
  model?: string;
}

export interface VoyageMultimodalRequest {
  input: Array<{
    type: 'text' | 'image';
    text?: string;
    image?: string;
  }>;
  model?: string;
}

export interface VoyageEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

export interface EmbeddingServiceConfig {
  model: string;
  dimensions: number;
  maxRetries: number;
  retryDelay: number;
  baseUrl: string;
}

export class EmbeddingService {
  private apiKey: string;
  private config: EmbeddingServiceConfig;
  private cache: CachingService;

  private static readonly VOYAGE_CONFIG: EmbeddingConfig = {
    provider: 'voyage',
    collectionName: 'voyage_embeddings',
    dimensions: 1024,
    distance: 'Cosine',
  };

  constructor(voyageApiKey: string, cache: CachingService, config?: Partial<EmbeddingServiceConfig>) {
    this.apiKey = voyageApiKey;
    this.cache = cache;
    this.config = {
      model: 'voyage-multimodal-3',
      dimensions: 1024,
      maxRetries: 3,
      retryDelay: 1000,
      baseUrl: 'https://api.voyageai.com/v1',
      ...config,
    };

    if (!this.apiKey) {
      throw new Error('Voyage API key is required for EmbeddingService');
    }
  }

  async generateEmbedding(content: string | MultimodalInput[]): Promise<EmbeddingResult> {
    if (typeof content === 'string') {
      return this.generateTextEmbedding(content);
    }
      return this.generateMultimodalEmbedding(content);
  }

  async generateTextEmbedding(text: string, retries: number = this.config.maxRetries): Promise<EmbeddingResult> {
    const cacheKey = this.createTextEmbeddingCacheKey(text);

    const cached = await this.cache.get<number[]>(cacheKey);
    if (cached) {
      return {
        vector: cached,
        dimensions: this.config.dimensions,
        provider: 'voyage',
        collectionConfig: {
          name: EmbeddingService.VOYAGE_CONFIG.collectionName,
          dimensions: this.config.dimensions,
          distance: EmbeddingService.VOYAGE_CONFIG.distance,
        },
      };
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: this.config.model,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voyage API request failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as VoyageEmbeddingResponse;

      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('Invalid embedding response format');
      }

      const embedding = result.data[0].embedding;

      if (embedding.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embedding.length}`,
        );
      }

      await this.cache.set(cacheKey, embedding, CacheTTL.CLIP_TEXT_EMBEDDING);

      return {
        vector: embedding,
        dimensions: this.config.dimensions,
        provider: 'voyage',
        collectionConfig: {
          name: EmbeddingService.VOYAGE_CONFIG.collectionName,
          dimensions: this.config.dimensions,
          distance: EmbeddingService.VOYAGE_CONFIG.distance,
        },
      };
    } catch (error) {
      if (retries > 0) {
        console.warn(`Voyage text embedding failed, retrying (${retries} retries left)`, error);
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        return this.generateTextEmbedding(text, retries - 1);
      }

      console.error('[EmbeddingService] Text embedding generation failed after retries', error);
      let errorMessage = 'An unknown error occurred during text embedding generation';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      throw new Error(`Failed to generate text embedding: ${errorMessage}`);
    }
  }

  async generateImageEmbedding(imageBase64: string, retries: number = this.config.maxRetries): Promise<EmbeddingResult> {
    const cacheKey = this.createImageEmbeddingCacheKey(imageBase64);

    const cached = await this.cache.get<number[]>(cacheKey);
    if (cached) {
      return {
        vector: cached,
        dimensions: this.config.dimensions,
        provider: 'voyage',
        collectionConfig: {
          name: EmbeddingService.VOYAGE_CONFIG.collectionName,
          dimensions: this.config.dimensions,
          distance: EmbeddingService.VOYAGE_CONFIG.distance,
        },
      };
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [
            {
              type: 'image',
              image: imageBase64,
            },
          ],
          model: this.config.model,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voyage API request failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as VoyageEmbeddingResponse;

      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('Invalid embedding response format');
      }

      const embedding = result.data[0].embedding;

      if (embedding.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embedding.length}`,
        );
      }

      await this.cache.set(cacheKey, embedding, CacheTTL.CLIP_IMAGE_EMBEDDING);

      return {
        vector: embedding,
        dimensions: this.config.dimensions,
        provider: 'voyage',
        collectionConfig: {
          name: EmbeddingService.VOYAGE_CONFIG.collectionName,
          dimensions: this.config.dimensions,
          distance: EmbeddingService.VOYAGE_CONFIG.distance,
        },
      };
    } catch (error) {
      if (retries > 0) {
        console.warn(`Voyage image embedding failed, retrying (${retries} retries left)`, error);
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        return this.generateImageEmbedding(imageBase64, retries - 1);
      }

      console.error('[EmbeddingService] Image embedding generation failed after retries', error);
      let errorMessage = 'An unknown error occurred during image embedding generation';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      throw new Error(`Failed to generate image embedding: ${errorMessage}`);
    }
  }

  async generateMultimodalEmbedding(
    inputs: MultimodalInput[],
    retries: number = this.config.maxRetries,
  ): Promise<EmbeddingResult> {
    const inputString = JSON.stringify(inputs);
    const cacheKey = this.createMultimodalEmbeddingCacheKey(inputString);

    const cached = await this.cache.get<number[]>(cacheKey);
    if (cached) {
      return {
        vector: cached,
        dimensions: this.config.dimensions,
        provider: 'voyage',
        collectionConfig: {
          name: EmbeddingService.VOYAGE_CONFIG.collectionName,
          dimensions: this.config.dimensions,
          distance: EmbeddingService.VOYAGE_CONFIG.distance,
        },
      };
    }

    try {
      const voyageInputs = inputs.map((input) => {
        if (input.type === 'text') {
          return {
            type: 'text' as const,
            text: input.content,
          };
        }
        return {
          type: 'image' as const,
          image: input.content,
        };
      });

      const response = await fetch(`${this.config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: voyageInputs,
          model: this.config.model,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voyage API request failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as VoyageEmbeddingResponse;

      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('Invalid embedding response format');
      }

      const embedding = result.data[0].embedding;

      if (embedding.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embedding.length}`,
        );
      }

      await this.cache.set(cacheKey, embedding, CacheTTL.CLIP_MULTIMODAL_EMBEDDING);

      return {
        vector: embedding,
        dimensions: this.config.dimensions,
        provider: 'voyage',
        collectionConfig: {
          name: EmbeddingService.VOYAGE_CONFIG.collectionName,
          dimensions: this.config.dimensions,
          distance: EmbeddingService.VOYAGE_CONFIG.distance,
        },
      };
    } catch (error) {
      if (retries > 0) {
        console.warn(
          `Voyage multimodal embedding failed, retrying (${retries} retries left)`,
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        return this.generateMultimodalEmbedding(inputs, retries - 1);
      }

      console.error('[EmbeddingService] Multimodal embedding generation failed after retries', error);
      let errorMessage = 'An unknown error occurred during multimodal embedding generation';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      throw new Error(`Failed to generate multimodal embedding: ${errorMessage}`);
    }
  }

  async storeEmbedding(
    id: string,
    embeddingResult: EmbeddingResult,
    payload: Record<string, any>,
    qdrantClient: QdrantClient,
  ): Promise<void> {
    await qdrantClient.upsertVector({
      id,
      vector: embeddingResult.vector,
      payload: {
        ...payload,
        embedding_provider: embeddingResult.provider,
        embedding_dimensions: embeddingResult.dimensions,
      },
      collectionConfig: embeddingResult.collectionConfig,
    });
  }

  async generatePostEmbedding(
    postId: string,
    content: string,
    hashtags: string[],
    userId: string,
    isPrivate: boolean,
    provider: EmbeddingProvider = 'voyage',
  ): Promise<{
    embeddingResult: EmbeddingResult;
    metadata: {
      postId: string;
      userId: string;
      text: string;
      createdAt: string;
      isPrivate: boolean;
      contentType: string;
      embeddingProvider: EmbeddingProvider;
    };
  }> {
    const text = content + (hashtags.length > 0 ? ` ${hashtags.join(' ')}` : '');
    const embeddingResult = await this.generateTextEmbedding(text);

    const metadata = {
      postId,
      userId,
      text,
      createdAt: new Date().toISOString(),
      isPrivate,
      contentType: 'text',
      embeddingProvider: provider,
    };

    return { embeddingResult, metadata };
  }

  async searchSimilar(
    queryVector: number[],
    limit: number,
    filter?: Record<string, any>,
    provider?: EmbeddingProvider,
    qdrantClient?: QdrantClient,
  ): Promise<
    Array<{ id: string; score: number; payload: Record<string, any>; provider: EmbeddingProvider }>
  > {
    if (!qdrantClient) {
      throw new Error('QdrantClient is required for searching');
    }

    const config = this.getConfigForProvider(provider || 'voyage');
    const results = await qdrantClient.searchVectors({
      vector: queryVector,
      limit,
      filter,
      collectionConfig: {
        name: config.collectionName,
        dimensions: config.dimensions,
        distance: config.distance,
      },
    });

    return results.map((result) => ({
      ...result,
      provider: provider || 'voyage',
    }));
  }

  getDimensions(): number {
    return this.config.dimensions;
  }

  getModel(): string {
    return this.config.model;
  }

  getAvailableProviders(): EmbeddingProvider[] {
    return ['voyage'];
  }

  private getConfigForProvider(provider: EmbeddingProvider): EmbeddingConfig {
    switch (provider) {
      case 'voyage':
        return EmbeddingService.VOYAGE_CONFIG;
      default:
        throw new Error(`Unknown embedding provider: ${provider}`);
    }
  }

  private createTextEmbeddingCacheKey(text: string): string {
    const textHash = this.hashString(text);
    return `voyage_text_embedding:${this.config.model}:${this.config.dimensions}:${textHash}`;
  }

  private createImageEmbeddingCacheKey(imageBase64: string): string {
    const imageHash = this.hashString(imageBase64);
    return `voyage_image_embedding:${this.config.model}:${this.config.dimensions}:${imageHash}`;
  }

  private createMultimodalEmbeddingCacheKey(inputString: string): string {
    const inputHash = this.hashString(inputString);
    return `voyage_multimodal_embedding:${this.config.model}:${this.config.dimensions}:${inputHash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }
}

export function createEmbeddingService(
  env: Bindings,
  cache: CachingService,
  config?: Partial<EmbeddingServiceConfig>,
): EmbeddingService {
  return new EmbeddingService(env.VOYAGE_API_KEY, cache, config);
}