import type { Bindings } from '../types';
import type { CachingService } from '../cache/cachingService';
import { CacheTTL } from '../cache/cachingService';

export interface VoyageTextRequest {
  input: string | string[];
  model?: string;
}

export interface VoyageMultimodalRequest {
  input: Array<{
    type: 'text' | 'image';
    text?: string;
    image?: string; // Base64 encoded image
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

export interface VoyageServiceConfig {
  model: string;
  dimensions: number;
  maxRetries: number;
  retryDelay: number;
  baseUrl: string;
}

export class VoyageService {
  private apiKey: string;
  private config: VoyageServiceConfig;
  private cache?: CachingService;

  constructor(env: Bindings, cache?: CachingService, config?: Partial<VoyageServiceConfig>) {
    this.apiKey = env.VOYAGE_API_KEY || '';
    this.cache = cache;
    this.config = {
      model: 'voyage-multimodal-3',
      dimensions: 1024, // Voyage standard dimension for multimodal
      maxRetries: 3,
      retryDelay: 1000,
      baseUrl: 'https://api.voyageai.com/v1',
      ...config,
    };

    if (!this.apiKey) {
      throw new Error('Voyage API key is required for Voyage service');
    }
  }

  async generateTextEmbedding(
    text: string,
    retries: number = this.config.maxRetries,
  ): Promise<number[]> {
    // Create cache key for text embedding
    const cacheKey = this.createTextEmbeddingCacheKey(text);

    // Try to get from cache first
    if (this.cache) {
      const cached = await this.cache.get<number[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
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

      // Validate embedding dimensions
      if (embedding.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embedding.length}`,
        );
      }

      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, embedding, CacheTTL.CLIP_TEXT_EMBEDDING);
      }

      return embedding;
    } catch (error) {
      if (retries > 0) {
        console.warn(`Voyage text embedding failed, retrying (${retries} retries left)`, error);
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        return this.generateTextEmbedding(text, retries - 1);
      }

      console.error('[VoyageService] Text embedding generation failed after retries', error);
      let errorMessage = 'An unknown error occurred during text embedding generation';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      throw new Error(`Failed to generate text embedding: ${errorMessage}`);
    }
  }

  async generateImageEmbedding(
    imageBase64: string,
    retries: number = this.config.maxRetries,
  ): Promise<number[]> {
    // Create cache key for image embedding
    const cacheKey = this.createImageEmbeddingCacheKey(imageBase64);

    // Try to get from cache first
    if (this.cache) {
      const cached = await this.cache.get<number[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
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

      // Validate embedding dimensions
      if (embedding.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embedding.length}`,
        );
      }

      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, embedding, CacheTTL.CLIP_IMAGE_EMBEDDING);
      }

      return embedding;
    } catch (error) {
      if (retries > 0) {
        console.warn(`Voyage image embedding failed, retrying (${retries} retries left)`, error);
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        return this.generateImageEmbedding(imageBase64, retries - 1);
      }

      console.error('[VoyageService] Image embedding generation failed after retries', error);
      let errorMessage = 'An unknown error occurred during image embedding generation';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      throw new Error(`Failed to generate image embedding: ${errorMessage}`);
    }
  }

  async generateMultimodalEmbedding(
    inputs: Array<{ type: 'text' | 'image'; content: string }>,
    retries: number = this.config.maxRetries,
  ): Promise<number[]> {
    // Create cache key for multimodal embedding
    const inputString = JSON.stringify(inputs);
    const cacheKey = this.createMultimodalEmbeddingCacheKey(inputString);

    // Try to get from cache first
    if (this.cache) {
      const cached = await this.cache.get<number[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Transform inputs to Voyage format
      const voyageInputs = inputs.map((input) => {
        if (input.type === 'text') {
          return {
            type: 'text' as const,
            text: input.content,
          };
        } else {
          return {
            type: 'image' as const,
            image: input.content, // Assuming base64 encoded
          };
        }
      });

      const response = await fetch(`${this.config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
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

      // Validate embedding dimensions
      if (embedding.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embedding.length}`,
        );
      }

      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, embedding, CacheTTL.CLIP_MULTIMODAL_EMBEDDING);
      }

      return embedding;
    } catch (error) {
      if (retries > 0) {
        console.warn(
          `Voyage multimodal embedding failed, retrying (${retries} retries left)`,
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        return this.generateMultimodalEmbedding(inputs, retries - 1);
      }

      console.error('[VoyageService] Multimodal embedding generation failed after retries', error);
      let errorMessage = 'An unknown error occurred during multimodal embedding generation';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      throw new Error(`Failed to generate multimodal embedding: ${errorMessage}`);
    }
  }

  getDimensions(): number {
    return this.config.dimensions;
  }

  getModel(): string {
    return this.config.model;
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
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }
}

export function createVoyageService(
  env: Bindings,
  cache?: CachingService,
  config?: Partial<VoyageServiceConfig>,
): VoyageService {
  return new VoyageService(env, cache, config);
}
