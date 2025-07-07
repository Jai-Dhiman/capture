import type { Bindings } from '../../types';
import { createCachingService, CacheKeys, CacheTTL, type CachingService } from '../cache/cachingService';
import { 
  ImageMetadata, 
  ImageVariant, 
  ImageTransformation, 
  MetadataValidationResult,
  MetadataStorageConfig
} from './metadata';
import { nanoid } from 'nanoid';

export class MetadataService {
  private r2: R2Bucket;
  private kv: KVNamespace;
  private cachingService: CachingService;
  private config: MetadataStorageConfig;

  constructor(env: Bindings, config?: Partial<MetadataStorageConfig>) {
    this.r2 = env.IMAGE_STORAGE;
    this.kv = env.METADATA_KV;
    this.cachingService = createCachingService(env);
    
    this.config = {
      useR2CustomMetadata: true,
      useWorkersKV: true,
      kvNamespace: 'metadata',
      cacheTTL: 3600,
      enableSearch: false, // Disable for beta - simple tagging only
      enableAnalytics: false, // Disable for beta - add later for recommendations
      ...config
    };
  }

  /**
   * Store metadata for an image
   */
  async storeMetadata(imageId: string, metadata: ImageMetadata): Promise<void> {
    const validation = this.validateMetadata(metadata);
    if (!validation.isValid) {
      throw new Error(`Invalid metadata: ${validation.errors.join(', ')}`);
    }

    const metadataJson = JSON.stringify(metadata);
    const storageKey = `images/${imageId}`;
    
    // Store in R2 custom metadata
    if (this.config.useR2CustomMetadata) {
      try {
        const existingObject = await this.r2.head(storageKey);
        if (existingObject) {
          // Update existing object metadata
          await this.r2.put(storageKey, existingObject.body, {
            customMetadata: {
              'metadata': metadataJson,
              'updated-at': new Date().toISOString()
            }
          });
        }
      } catch (error) {
        console.warn('Failed to store R2 custom metadata:', error);
      }
    }

    // Store in Workers KV for search
    if (this.config.useWorkersKV) {
      const kvKey = `metadata:${imageId}`;
      await this.kv.put(kvKey, metadataJson, {
        expirationTtl: this.config.cacheTTL
      });

      // Store search indexes
      await this.updateSearchIndexes(imageId, metadata);
    }

    // Cache the metadata
    const cacheKey = CacheKeys.metadata(imageId);
    await this.cachingService.set(cacheKey, metadata, CacheTTL.METADATA);
  }

  /**
   * Retrieve metadata for an image
   */
  async getMetadata(imageId: string): Promise<ImageMetadata | null> {
    const cacheKey = CacheKeys.metadata(imageId);
    
    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        // Try Workers KV first
        if (this.config.useWorkersKV) {
          const kvKey = `metadata:${imageId}`;
          const kvResult = await this.kv.get(kvKey);
          if (kvResult) {
            return JSON.parse(kvResult) as ImageMetadata;
          }
        }

        // Fallback to R2 custom metadata
        if (this.config.useR2CustomMetadata) {
          try {
            const storageKey = `images/${imageId}`;
            const objectHead = await this.r2.head(storageKey);
            if (objectHead?.customMetadata?.metadata) {
              return JSON.parse(objectHead.customMetadata.metadata) as ImageMetadata;
            }
          } catch (error) {
            console.warn('Failed to retrieve R2 custom metadata:', error);
          }
        }

        return null;
      },
      CacheTTL.METADATA
    );
  }

  /**
   * Update specific metadata fields
   */
  async updateMetadata(imageId: string, updates: Partial<ImageMetadata>): Promise<void> {
    const existingMetadata = await this.getMetadata(imageId);
    if (!existingMetadata) {
      throw new Error(`Metadata not found for image: ${imageId}`);
    }

    const updatedMetadata: ImageMetadata = {
      ...existingMetadata,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.storeMetadata(imageId, updatedMetadata);
  }

  /**
   * Delete metadata for an image
   */
  async deleteMetadata(imageId: string): Promise<void> {
    // Remove from KV
    if (this.config.useWorkersKV) {
      const kvKey = `metadata:${imageId}`;
      await this.kv.delete(kvKey);
      
      // Remove from search indexes
      await this.removeFromSearchIndexes(imageId);
    }

    // Remove from cache
    const cacheKey = CacheKeys.metadata(imageId);
    await this.cachingService.delete(cacheKey);

    // Note: R2 custom metadata is removed when the object is deleted
  }

  /**
   * Extract metadata from image file
   */
  async extractMetadataFromFile(
    imageData: Uint8Array, 
    filename: string,
    userId: string
  ): Promise<Partial<ImageMetadata>> {
    // Basic metadata extraction
    const metadata: Partial<ImageMetadata> = {
      id: nanoid(),
      filename,
      originalName: filename,
      size: imageData.length,
      userId,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      visibility: 'private',
      tags: [],
      variants: [],
      transformations: [],
      isProcessed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Detect MIME type from file extension
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        metadata.mimeType = 'image/jpeg';
        metadata.format = 'jpeg';
        break;
      case 'png':
        metadata.mimeType = 'image/png';
        metadata.format = 'png';
        break;
      case 'webp':
        metadata.mimeType = 'image/webp';
        metadata.format = 'webp';
        break;
      case 'avif':
        metadata.mimeType = 'image/avif';
        metadata.format = 'avif';
        break;
      default:
        metadata.mimeType = 'application/octet-stream';
        metadata.format = 'unknown';
    }

    // TODO: Extract EXIF data and image dimensions
    // This would require additional libraries or WASM modules

    return metadata;
  }

  /**
   * Add variant to metadata
   */
  async addVariant(imageId: string, variant: ImageVariant): Promise<void> {
    const metadata = await this.getMetadata(imageId);
    if (!metadata) {
      throw new Error(`Metadata not found for image: ${imageId}`);
    }

    const existingVariantIndex = metadata.variants.findIndex(v => v.name === variant.name);
    if (existingVariantIndex >= 0) {
      metadata.variants[existingVariantIndex] = variant;
    } else {
      metadata.variants.push(variant);
    }

    await this.storeMetadata(imageId, metadata);
  }

  /**
   * Add transformation to metadata
   */
  async addTransformation(imageId: string, transformation: ImageTransformation): Promise<void> {
    const metadata = await this.getMetadata(imageId);
    if (!metadata) {
      throw new Error(`Metadata not found for image: ${imageId}`);
    }

    metadata.transformations.push(transformation);
    metadata.isProcessed = true;

    await this.storeMetadata(imageId, metadata);
  }

  /**
   * Update search indexes for metadata
   */
  private async updateSearchIndexes(imageId: string, metadata: ImageMetadata): Promise<void> {
    if (!this.config.enableSearch) return;

    const searchData = {
      id: imageId,
      userId: metadata.userId,
      tags: metadata.tags,
      category: metadata.category,
      format: metadata.format,
      size: metadata.size,
      width: metadata.width,
      height: metadata.height,
      uploadedAt: metadata.uploadedAt,
      visibility: metadata.visibility
    };

    // Store in search index
    await this.kv.put(`search:${imageId}`, JSON.stringify(searchData), {
      expirationTtl: this.config.cacheTTL
    });

    // Update tag indexes
    for (const tag of metadata.tags) {
      const tagKey = `tag:${tag}`;
      const existingTagData = await this.kv.get(tagKey);
      const tagImageIds = existingTagData ? JSON.parse(existingTagData) : [];
      
      if (!tagImageIds.includes(imageId)) {
        tagImageIds.push(imageId);
        await this.kv.put(tagKey, JSON.stringify(tagImageIds), {
          expirationTtl: this.config.cacheTTL
        });
      }
    }

    // Update user index
    const userKey = `user:${metadata.userId}`;
    const existingUserData = await this.kv.get(userKey);
    const userImageIds = existingUserData ? JSON.parse(existingUserData) : [];
    
    if (!userImageIds.includes(imageId)) {
      userImageIds.push(imageId);
      await this.kv.put(userKey, JSON.stringify(userImageIds), {
        expirationTtl: this.config.cacheTTL
      });
    }
  }

  /**
   * Remove from search indexes
   */
  private async removeFromSearchIndexes(imageId: string): Promise<void> {
    if (!this.config.enableSearch) return;

    const searchKey = `search:${imageId}`;
    const searchData = await this.kv.get(searchKey);
    
    if (searchData) {
      const metadata = JSON.parse(searchData);
      
      // Remove from tag indexes
      for (const tag of metadata.tags || []) {
        const tagKey = `tag:${tag}`;
        const tagData = await this.kv.get(tagKey);
        if (tagData) {
          const tagImageIds = JSON.parse(tagData).filter((id: string) => id !== imageId);
          if (tagImageIds.length > 0) {
            await this.kv.put(tagKey, JSON.stringify(tagImageIds));
          } else {
            await this.kv.delete(tagKey);
          }
        }
      }

      // Remove from user index
      const userKey = `user:${metadata.userId}`;
      const userData = await this.kv.get(userKey);
      if (userData) {
        const userImageIds = JSON.parse(userData).filter((id: string) => id !== imageId);
        if (userImageIds.length > 0) {
          await this.kv.put(userKey, JSON.stringify(userImageIds));
        } else {
          await this.kv.delete(userKey);
        }
      }
    }

    // Remove search entry
    await this.kv.delete(searchKey);
  }

  /**
   * Validate metadata structure
   */
  private validateMetadata(metadata: ImageMetadata): MetadataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!metadata.id) errors.push('ID is required');
    if (!metadata.filename) errors.push('Filename is required');
    if (!metadata.userId) errors.push('User ID is required');
    if (!metadata.storageKey) errors.push('Storage key is required');

    // Validate dimensions
    if (metadata.width && metadata.width <= 0) errors.push('Width must be positive');
    if (metadata.height && metadata.height <= 0) errors.push('Height must be positive');

    // Validate size
    if (metadata.size && metadata.size <= 0) errors.push('Size must be positive');

    // Validate visibility
    if (metadata.visibility && !['public', 'private', 'unlisted'].includes(metadata.visibility)) {
      errors.push('Invalid visibility value');
    }

    // Warnings
    if (!metadata.tags || metadata.tags.length === 0) {
      warnings.push('No tags provided - may affect discoverability');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export function createMetadataService(env: Bindings, config?: Partial<MetadataStorageConfig>): MetadataService {
  return new MetadataService(env, config);
}