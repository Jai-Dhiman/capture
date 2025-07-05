import type { Bindings } from '@/types';
import type { CachingService } from '../cache/cachingService';
import type { QdrantClient, CollectionConfig } from '../infrastructure/qdrantClient';
import { type VoyageService, createVoyageService } from './voyageService';

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

export class EmbeddingService {
  private voyageService: VoyageService;
  private cache: CachingService;

  // Collection configurations
  private static readonly VOYAGE_CONFIG: EmbeddingConfig = {
    provider: 'voyage',
    collectionName: 'voyage_embeddings',
    dimensions: 1024,
    distance: 'Cosine',
  };



  constructor(env: Bindings, cache: CachingService) {
    this.voyageService = createVoyageService(env, cache);
    this.cache = cache;
  }

  /**
   * Generate text embedding using specified provider
   */
  async generateTextEmbedding(
    text: string,
    provider: EmbeddingProvider = 'voyage',
  ): Promise<EmbeddingResult> {
    const config = this.getConfigForProvider(provider);
    let vector: number[];

    switch (provider) {
      case 'voyage':
        vector = await this.voyageService.generateTextEmbedding(text);
        break;
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }

    return {
      vector,
      dimensions: config.dimensions,
      provider,
      collectionConfig: {
        name: config.collectionName,
        dimensions: config.dimensions,
        distance: config.distance,
      },
    };
  }

  /**
   * Generate image embedding (only supported by Voyage)
   */
  async generateImageEmbedding(
    imageBase64: string,
    provider: EmbeddingProvider = 'voyage',
  ): Promise<EmbeddingResult> {
    // Only Voyage provider supports image embeddings

    const config = this.getConfigForProvider(provider);
    let vector: number[];

    switch (provider) {
      case 'voyage':
        vector = await this.voyageService.generateImageEmbedding(imageBase64);
        break;
      default:
        throw new Error(`Unsupported embedding provider for images: ${provider}`);
    }

    return {
      vector,
      dimensions: config.dimensions,
      provider,
      collectionConfig: {
        name: config.collectionName,
        dimensions: config.dimensions,
        distance: config.distance,
      },
    };
  }

  /**
   * Generate multimodal embedding (only supported by Voyage)
   */
  async generateMultimodalEmbedding(
    inputs: MultimodalInput[],
    provider: EmbeddingProvider = 'voyage',
  ): Promise<EmbeddingResult> {
    // Using Voyage provider for multimodal embeddings

    const config = this.getConfigForProvider(provider);
    const vector = await this.voyageService.generateMultimodalEmbedding(inputs);

    return {
      vector,
      dimensions: config.dimensions,
      provider,
      collectionConfig: {
        name: config.collectionName,
        dimensions: config.dimensions,
        distance: config.distance,
      },
    };
  }

  /**
   * Generate embedding for post content with hashtags
   */
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
    const embeddingResult = await this.generateTextEmbedding(text, provider);

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

  /**
   * Store embedding in appropriate Qdrant collection
   */
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

  /**
   * Search vectors across collections (can specify provider or search all)
   */
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

    if (provider) {
      // Search in specific provider's collection
      const config = this.getConfigForProvider(provider);
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
        provider,
      }));
    }
      // Search across all collections and merge results
      const allResults: Array<{
        id: string;
        score: number;
        payload: Record<string, any>;
        provider: EmbeddingProvider;
      }> = [];

      for (const providerType of ['voyage'] as EmbeddingProvider[]) {
        try {
          const config = this.getConfigForProvider(providerType);
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

          allResults.push(
            ...results.map((result) => ({
              ...result,
              provider: providerType,
            })),
          );
        } catch (error) {
          console.warn(`Failed to search in ${providerType} collection:`, error);
          // Continue with other collections
        }
      }

      // Sort by score and return top results
      return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
    }

  /**
   * Get available providers
   */
  getAvailableProviders(): EmbeddingProvider[] {
    return ['voyage'];
  }

  /**
   * Get configuration for a specific provider
   */
  private getConfigForProvider(provider: EmbeddingProvider): EmbeddingConfig {
    switch (provider) {
      case 'voyage':
        return EmbeddingService.VOYAGE_CONFIG;
      default:
        throw new Error(`Unknown embedding provider: ${provider}`);
    }
  }
}

export function createEmbeddingService(env: Bindings, cache: CachingService): EmbeddingService {
  return new EmbeddingService(env, cache);
}
