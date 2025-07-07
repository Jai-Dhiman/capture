import type { Bindings } from '../../types';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { media } from '../../db/schema';
import { nanoid } from 'nanoid';
import { R2_CONFIG } from './r2Config';
import { 
  type R2AuthenticationMiddleware, 
  type R2RateLimiter, 
  createR2AuthMiddleware,
  createR2RateLimiter 
} from './accessPolicies';
import { createCachingService, CacheKeys, CacheTTL, type CachingService } from '../cache/cachingService';
import { 
  WasmImageProcessor, 
  type ImageTransformParams,
} from '../wasm/wasmImageProcessor';
import { type MetadataService, createMetadataService } from './metadataService';
import type { ImageMetadata, ImageVariant, ImageTransformation } from './metadata';
import { CascadeDeletionService, type CascadeDeletionOptions } from './cascadeDeletionService';

function generateId(): string {
  return nanoid();
}

export interface ImageUploadResult {
  uploadURL: string;
  id: string;
}

export interface CreateMediaInput {
  userId: string;
  imageId: string;
  type?: string;
  order?: number;
  postId?: string;
  draftPostId?: string;
}

export interface ProcessEditedImageInput {
  originalImageId: string;
  editingMetadata: any;
  userId: string;
}

export interface ProcessEditedImageResult {
  processedImageId: string;
  variants: string[];
  originalSize?: number;
  processedSize?: number;
}

export class ImageService {
  private db: ReturnType<typeof drizzle>;
  private r2: R2Bucket;
  private bucketName: string;
  private authMiddleware: R2AuthenticationMiddleware;
  private rateLimiter: R2RateLimiter;
  private cachingService: CachingService;
  private wasmProcessor: WasmImageProcessor;
  private metadataService: MetadataService;
  private cascadeDeletionService: CascadeDeletionService;

  constructor(env: Bindings) {
    this.db = drizzle(env.DB);
    this.r2 = env.IMAGE_STORAGE;
    this.bucketName = R2_CONFIG.bucketName;
    this.authMiddleware = createR2AuthMiddleware();
    this.rateLimiter = createR2RateLimiter();
    this.cachingService = createCachingService(env);
    this.metadataService = createMetadataService(env);
    this.cascadeDeletionService = new CascadeDeletionService(env);
    
    // Initialize WASM image processor
    this.wasmProcessor = new WasmImageProcessor(512);
    
    // Initialize processor asynchronously
    this.wasmProcessor.initialize().catch(error => {
      console.error('Failed to initialize WASM processor:', error);
    });
  }

  async getUploadUrl(
    userId: string, 
    userRole = 'user',
    contentType?: string,
    fileSize?: number
  ): Promise<ImageUploadResult> {
    const id = generateId();
    const fileName = `${id}${this.getFileExtension(contentType)}`;
    const storageKey = `images/${userId}_${fileName}`;
    
    // Check rate limit
    const rateLimit = await this.rateLimiter.checkRateLimit(userId, 'upload', 10, 60000); // 10 uploads per minute
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Try again after ${new Date(rateLimit.resetTime).toISOString()}`);
    }
    
    // Validate access permissions
    const accessCheck = await this.authMiddleware.validateUpload(
      userId,
      userRole,
      fileName,
      fileSize || 0,
      contentType || 'application/octet-stream'
    );
    
    if (!accessCheck.allowed) {
      throw new Error(accessCheck.reason || 'Access denied');
    }
    
    // Validate content type if provided
    if (contentType && !R2_CONFIG.upload.allowedMimeTypes.includes(contentType)) {
      throw new Error(`Unsupported file type: ${contentType}`);
    }
    
    // Generate presigned URL for R2 upload with security headers
    const uploadURL = await this.r2.createPresignedUrl(storageKey, 'PUT', {
      expiresIn: R2_CONFIG.upload.presignedUrlExpiry,
      headers: {
        ...(contentType && { 'Content-Type': contentType }),
        'x-amz-server-side-encryption': 'AES256', // Enable encryption
      },
    });

    // Extract and store initial metadata
    try {
      const initialMetadata = await this.metadataService.extractMetadataFromFile(
        new Uint8Array(), // Empty for now, will be populated on actual upload
        fileName,
        userId
      );
      
      const fullMetadata: ImageMetadata = {
        ...initialMetadata,
        id: fileName,
        storageKey,
        filename: fileName,
        uploadedBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as ImageMetadata;
      
      // Store metadata (will be updated when file is actually uploaded)
      await this.metadataService.storeMetadata(fileName, fullMetadata);
    } catch (error) {
      console.warn('Failed to store initial metadata:', error);
    }

    return {
      uploadURL,
      id: fileName,
    };
  }

  async getBatchUploadUrls(
    userId: string,
    userRole = 'user',
    count: number,
    contentType?: string
  ): Promise<ImageUploadResult[]> {
    if (count > 10) {
      throw new Error('Maximum 10 uploads per batch');
    }

    const uploads: ImageUploadResult[] = [];
    
    for (let i = 0; i < count; i++) {
      const upload = await this.getUploadUrl(userId, userRole, contentType);
      uploads.push(upload);
    }
    
    return uploads;
  }

  async create(input: CreateMediaInput): Promise<any> {
    const id = generateId();
    const storageKey = `images/${input.imageId}`;
    
    const mediaRecord = {
      id,
      userId: input.userId,
      type: input.type || 'image',
      storageKey,
      order: input.order || 0,
      postId: input.postId || null,
      draftPostId: input.draftPostId || null,
      createdAt: new Date().toISOString(),
    };

    await this.db.insert(media).values(mediaRecord);
    
    return mediaRecord;
  }

  async createBatch(items: CreateMediaInput[]): Promise<any[]> {
    const mediaRecords = items.map((item, index) => ({
      id: generateId(),
      userId: item.userId,
      type: item.type || 'image',
      storageKey: `images/${item.imageId}`,
      order: item.order ?? index,
      postId: item.postId || null,
      draftPostId: item.draftPostId || null,
      createdAt: new Date().toISOString(),
    }));

    await this.db.insert(media).values(mediaRecords);
    
    return mediaRecords;
  }

  async findById(mediaId: string, userId: string): Promise<any> {
    const cacheKey = CacheKeys.media(mediaId);
    
    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        const result = await this.db
          .select()
          .from(media)
          .where(and(eq(media.id, mediaId), eq(media.userId, userId)))
          .limit(1);

        return result[0] || null;
      },
      CacheTTL.MEDIA // 1 hour cache
    );
  }

  async getImageUrl(storageKey: string, _visibility: string, expirySeconds?: number): Promise<string> {
    const expiry = expirySeconds || R2_CONFIG.upload.downloadUrlExpiry;
    
    // For long-term URLs (> 1 hour), use caching to avoid regenerating frequently
    if (expiry > 3600) {
      const cacheKey = `image_url:${storageKey}:${expiry}`;
      
      return this.cachingService.getOrSet(
        cacheKey,
        async () => {
          return await this.r2.createPresignedUrl(storageKey, 'GET', {
            expiresIn: expiry,
          });
        },
        Math.min(expiry / 2, CacheTTL.LONG) // Cache for half the URL lifetime or 30 minutes max
      );
    }
    
    // For short-term URLs, generate directly without caching
    const url = await this.r2.createPresignedUrl(storageKey, 'GET', {
      expiresIn: expiry,
    });

    return url;
  }

  async getDirectCloudflareUrl(cloudflareId: string, _visibility: string, expirySeconds: number): Promise<string> {
    const storageKey = `images/${cloudflareId}`;
    return this.getImageUrl(storageKey, _visibility, expirySeconds);
  }

  async delete(mediaId: string, userId: string, userRole: string = 'user', options?: { permanent?: boolean, softDelete?: boolean }): Promise<{ success: boolean; deletedVariants: string[]; errors?: string[] }> {
    // Check rate limit
    const rateLimit = await this.rateLimiter.checkRateLimit(userId, 'delete', 20, 60000); // 20 deletes per minute
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Try again after ${new Date(rateLimit.resetTime).toISOString()}`);
    }

    // Use the simplified cascade deletion service
    const cascadeOptions: CascadeDeletionOptions = {
      permanent: options?.permanent ?? true,
      softDelete: options?.softDelete ?? false
    };

    const result = await this.cascadeDeletionService.executeCascadeDeletion(mediaId, userId, cascadeOptions);
    
    // Transform the result format to match the expected return type
    return {
      success: result.success,
      deletedVariants: result.deletedVariants,
      errors: result.errors.length > 0 ? result.errors : undefined
    };
  }

  async deleteCascade(mediaRecord: any, userId: string, options?: { permanent?: boolean, softDelete?: boolean }): Promise<{ success: boolean; deletedVariants: string[]; errors?: string[] }> {
    const deletedVariants: string[] = [];
    const errors: string[] = [];
    const permanent = options?.permanent ?? true;
    const softDelete = options?.softDelete ?? false;

    try {
      // Begin transaction-like operations
      const cleanup = [];
      
      // 1. Get all variants and related data
      const metadata = await this.metadataService.getMetadata(mediaRecord.id);
      const variants = metadata?.variants || [];
      
      // 2. Delete all variants from storage
      for (const variant of variants) {
        try {
          await this.r2.delete(variant.storageKey);
          deletedVariants.push(variant.id);
          cleanup.push(() => this.r2.put(variant.storageKey, new Uint8Array(), { httpMetadata: { contentType: 'image/jpeg' } }));
        } catch (error) {
          errors.push(`Failed to delete variant ${variant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // 3. Delete main image from storage
      if (permanent) {
        try {
          await this.r2.delete(mediaRecord.storageKey);
          cleanup.push(() => this.r2.put(mediaRecord.storageKey, new Uint8Array(), { httpMetadata: { contentType: 'image/jpeg' } }));
        } catch (error) {
          errors.push(`Failed to delete main image: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // If main deletion fails, rollback variants
          for (const cleanupFn of cleanup) {
            try {
              await cleanupFn();
            } catch (rollbackError) {
              console.error('Rollback failed:', rollbackError);
            }
          }
          throw error;
        }
      }
      
      // 4. Delete metadata
      if (permanent) {
        await this.metadataService.deleteMetadata(mediaRecord.id);
      } else {
        // Soft delete - mark as deleted in metadata
        await this.metadataService.updateMetadata(mediaRecord.id, {
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: userId
        });
      }
      
      // 5. Update database record
      if (permanent) {
        await this.db
          .delete(media)
          .where(and(eq(media.id, mediaRecord.id), eq(media.userId, userId)));
      } else {
        // For soft delete, we'd add a deletedAt field to the schema
        // For now, keep the record but mark in metadata
      }

      // 6. Invalidate all related cache entries
      await this.invalidateAllCaches(mediaRecord);
      
      return {
        success: true,
        deletedVariants,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      console.error('Delete cascade failed:', error);
      return {
        success: false,
        deletedVariants,
        errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async deleteBatch(mediaIds: string[], userId: string, userRole: string = 'user', options?: { permanent?: boolean, softDelete?: boolean }): Promise<{ results: Array<{ id: string; success: boolean; deletedVariants: string[]; errors?: string[] }>; summary: { total: number; successful: number; failed: number } }> {
    // Check batch size limit
    if (mediaIds.length > 20) {
      throw new Error('Maximum 20 items per batch deletion');
    }
    
    // Check rate limit for batch operations
    const rateLimit = await this.rateLimiter.checkRateLimit(userId, 'batch_delete', 5, 60000); // 5 batch operations per minute
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Try again after ${new Date(rateLimit.resetTime).toISOString()}`);
    }
    
    // Use the simplified cascade deletion service for batch operations
    const cascadeOptions: CascadeDeletionOptions = {
      permanent: options?.permanent ?? true,
      softDelete: options?.softDelete ?? false
    };

    const batchResult = await this.cascadeDeletionService.executeBatchCascadeDeletion(mediaIds, userId, cascadeOptions);
    
    // Transform the result format to match the expected return type
    const results = batchResult.results.map(result => ({
      id: result.mediaId,
      success: result.success,
      deletedVariants: result.deletedVariants,
      errors: result.errors.length > 0 ? result.errors : undefined
    }));
    
    return {
      results,
      summary: batchResult.summary
    };
  }

  private async invalidateAllCaches(mediaRecord: any): Promise<void> {
    // Invalidate direct cache entries
    await this.cachingService.delete(CacheKeys.media(mediaRecord.id));
    
    // Invalidate URL caches
    await this.cachingService.invalidatePattern(`image_url:${mediaRecord.storageKey}:*`);
    
    // Invalidate CDN cache patterns
    await this.cachingService.invalidatePattern(CacheKeys.cdnUrlPattern(mediaRecord.id));
    await this.cachingService.invalidatePattern(CacheKeys.mediaUrlPattern(mediaRecord.storageKey));
    
    // Purge CDN cache
    await this.purgeCDNCache(mediaRecord.storageKey);
  }

  async processEditedImage(input: ProcessEditedImageInput): Promise<ProcessEditedImageResult> {
    const processedImageId = generateId();
    const variants = [`${processedImageId}-small`, `${processedImageId}-medium`, `${processedImageId}-large`];
    
    try {
      // Get the original image from R2 storage
      const originalStorageKey = `images/${input.originalImageId}`;
      const originalImage = await this.r2.get(originalStorageKey);
      
      if (!originalImage) {
        throw new Error('Original image not found');
      }
      
      const originalImageData = new Uint8Array(await originalImage.arrayBuffer());
      const startTime = performance.now();
      
      // Extract processing parameters from editing metadata
      const params: ImageTransformParams = this.extractTransformParams(input.editingMetadata);
      
      // Process the image using WASM pipeline
      const result = await this.wasmProcessor.processImage(originalImageData, params);
      
      // Store the processed image
      const processedStorageKey = `images/${processedImageId}`;
      await this.r2.put(processedStorageKey, result.processedData, {
        httpMetadata: {
          contentType: `image/${result.format}`,
        },
      });
      
      // Store transformation metadata
      const transformation: ImageTransformation = {
        id: nanoid(),
        type: 'enhancement',
        parameters: params,
        appliedAt: new Date().toISOString(),
        appliedBy: input.userId
      };

      await this.metadataService.addTransformation(input.originalImageId, transformation);

      // Create variants asynchronously in the background
      this.createVariantsAsync(originalImageData, processedImageId, variants)
        .catch(error => console.error('Failed to create variants:', error));
      
      return {
        processedImageId,
        variants,
        originalSize: originalImageData.length,
        processedSize: result.size,
      };
      
    } catch (error) {
      console.error('Image processing failed:', error);
      
      // Fallback: return original image ID with empty variants
      return {
        processedImageId: input.originalImageId,
        variants: [],
      };
    }
  }

  async optimizeForVariants(processedImageId: string, variants: string[]): Promise<void> {
    try {
      // Get the processed image from R2 storage
      const processedStorageKey = `images/${processedImageId}`;
      const processedImage = await this.r2.get(processedStorageKey);
      
      if (!processedImage) {
        throw new Error('Processed image not found');
      }
      
      const imageData = new Uint8Array(await processedImage.arrayBuffer());
      
      // Define variant configurations
      const variantConfigs: { [key: string]: ImageTransformParams } = {
        small: { width: 400, height: 400, quality: 80, format: 'webp', fit: 'cover' },
        medium: { width: 800, height: 800, quality: 85, format: 'webp', fit: 'cover' },
        large: { width: 1200, height: 1200, quality: 90, format: 'webp', fit: 'cover' },
      };
      
      // Process variants using WASM
      const variantResults = await this.wasmProcessor.createVariants(imageData, variantConfigs);
      
      // Store each variant in R2 and update metadata
      const storagePromises = Object.entries(variantResults).map(async ([variantName, result]) => {
        const variantKey = `images/${processedImageId}-${variantName}`;
        await this.r2.put(variantKey, result.processedData, {
          httpMetadata: {
            contentType: `image/${result.format}`,
          },
        });

        // Store variant metadata
        const variant: ImageVariant = {
          id: `${processedImageId}-${variantName}`,
          name: variantName,
          storageKey: variantKey,
          width: result.width,
          height: result.height,
          size: result.size,
          format: result.format,
          quality: variantConfigs[variantName].quality || 85,
          createdAt: new Date().toISOString()
        };

        await this.metadataService.addVariant(processedImageId, variant);
      });
      
      await Promise.all(storagePromises);
      
      console.log(`Successfully optimized ${processedImageId} for ${Object.keys(variantResults).length} variants`);
      
    } catch (error) {
      console.error(`Failed to optimize variants for ${processedImageId}:`, error);
      throw error;
    }
  }

  // Utility methods for R2 bucket configuration
  async validateFile(file: File): Promise<boolean> {
    // Check file size
    if (file.size > R2_CONFIG.upload.maxFileSize) {
      throw new Error(`File too large. Maximum size: ${R2_CONFIG.upload.maxFileSize} bytes`);
    }

    // Check MIME type
    if (!R2_CONFIG.upload.allowedMimeTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    return true;
  }

  async getVariantKey(originalKey: string, variant: keyof typeof R2_CONFIG.variants): Promise<string> {
    const extension = originalKey.split('.').pop() || 'jpg';
    const baseName = originalKey.replace(/\.[^/.]+$/, '');
    return `${baseName}_${variant}.${extension}`;
  }

  async configureBucketCORS(): Promise<void> {
    // This would typically be done through Cloudflare API or dashboard
    // For now, log the required CORS configuration
    console.log('CORS configuration required:', R2_CONFIG.corsPolicy);
  }

  async purgeCDNCache(storageKey: string): Promise<{ urls: string[] }> {
    // Generate list of URLs to purge for different variants and formats
    const baseUrl = `https://capture-images.r2.cloudflarestorage.com/${storageKey}`;
    const urlsToPurge = [
      baseUrl,
      `${baseUrl}?variant=small`,
      `${baseUrl}?variant=medium`, 
      `${baseUrl}?variant=large`,
      `${baseUrl}?format=webp`,
      `${baseUrl}?format=avif`,
      `${baseUrl}?variant=small&format=webp`,
      `${baseUrl}?variant=medium&format=webp`,
      `${baseUrl}?variant=large&format=webp`,
    ];

    // TODO: Implement actual Cloudflare Cache API purging
    // This would typically use the Cloudflare API to purge specific URLs
    // For now, log the URLs that would be purged
    console.log('Purging CDN cache for URLs:', urlsToPurge);
    
    return { urls: urlsToPurge };
  }

  async configureCDNRules(): Promise<void> {
    // This method would configure Cloudflare Page Rules or Workers for CDN behavior
    // Including cache TTL, browser cache TTL, edge cache TTL, etc.
    const cdnConfig = {
      cacheLevel: 'standard',
      browserCacheTtl: 31536000, // 1 year
      edgeCacheTtl: 31536000, // 1 year
      cacheByDeviceType: false,
      cacheDeceptionArmor: true,
      waf: true,
      ssl: 'full',
      alwaysUseHttps: true,
      ipGeolocation: true,
      emailObfuscation: false,
      serverSideExcludes: false,
      hotlinkProtection: false,
      securityLevel: 'medium',
      challengeTtl: 1800,
      browserIntegrityCheck: true,
      cacheByQueryString: true,
      sortQueryStringForCache: true,
    };
    
    console.log('CDN configuration would be applied:', cdnConfig);
    
    // TODO: Implement actual Cloudflare API calls to configure these rules
    // This would use the Cloudflare API to create page rules or zone settings
  }

  /**
   * Extract image transformation parameters from editing metadata
   */
  private extractTransformParams(editingMetadata: any): ImageTransformParams {
    const params: ImageTransformParams = {};
    
    // Extract basic transformation parameters
    if (editingMetadata.width) params.width = Number(editingMetadata.width);
    if (editingMetadata.height) params.height = Number(editingMetadata.height);
    if (editingMetadata.quality) params.quality = Number(editingMetadata.quality);
    if (editingMetadata.format) params.format = editingMetadata.format;
    if (editingMetadata.fit) params.fit = editingMetadata.fit;
    
    // Extract advanced parameters
    if (editingMetadata.blur) params.blur = Number(editingMetadata.blur);
    if (editingMetadata.brightness) params.brightness = Number(editingMetadata.brightness);
    if (editingMetadata.contrast) params.contrast = Number(editingMetadata.contrast);
    if (editingMetadata.saturation) params.saturation = Number(editingMetadata.saturation);
    if (editingMetadata.rotate) params.rotate = Number(editingMetadata.rotate);
    if (editingMetadata.flip_horizontal) params.flip_horizontal = Boolean(editingMetadata.flip_horizontal);
    if (editingMetadata.flip_vertical) params.flip_vertical = Boolean(editingMetadata.flip_vertical);
    
    // Default values if not specified
    if (!params.quality) params.quality = 85;
    if (!params.format) params.format = 'webp';
    if (!params.fit) params.fit = 'cover';
    
    return params;
  }

  /**
   * Create image variants asynchronously in the background
   */
  private async createVariantsAsync(
    originalImageData: Uint8Array, 
    processedImageId: string, 
    variants: string[]
  ): Promise<void> {
    try {
      // Define standard variant configurations
      const variantConfigs: { [key: string]: ImageTransformParams } = {
        small: { width: 400, height: 400, quality: 80, format: 'webp', fit: 'cover' },
        medium: { width: 800, height: 800, quality: 85, format: 'webp', fit: 'cover' },
        large: { width: 1200, height: 1200, quality: 90, format: 'webp', fit: 'cover' },
      };
      
      // Create variants using WASM processor
      const variantResults = await this.wasmProcessor.createVariants(originalImageData, variantConfigs);
      
      // Store each variant in R2
      const storagePromises = Object.entries(variantResults).map(async ([variantName, result]) => {
        const variantKey = `images/${processedImageId}-${variantName}`;
        await this.r2.put(variantKey, result.processedData, {
          httpMetadata: {
            contentType: `image/${result.format}`,
          },
        });
      });
      
      await Promise.all(storagePromises);
      console.log(`Background variant creation completed for ${processedImageId}`);
      
    } catch (error) {
      console.error(`Background variant creation failed for ${processedImageId}:`, error);
    }
  }

  /**
   * Get WASM processor status
   */
  getProcessorStatus(): any {
    return this.wasmProcessor.getStatus();
  }

  /**
   * Clear WASM processor memory
   */
  clearProcessorMemory(): void {
    this.wasmProcessor.clearMemory();
  }

  /**
   * Check if processor can handle more work
   */
  canProcessMore(): boolean {
    return this.wasmProcessor.canProcessMore();
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(imageId: string): Promise<ImageMetadata | null> {
    return this.metadataService.getMetadata(imageId);
  }

  /**
   * Update image metadata
   */
  async updateImageMetadata(imageId: string, updates: Partial<ImageMetadata>): Promise<void> {
    return this.metadataService.updateMetadata(imageId, updates);
  }

  /**
   * Add tags to image
   */
  async addImageTags(imageId: string, tags: string[]): Promise<void> {
    const metadata = await this.metadataService.getMetadata(imageId);
    if (!metadata) {
      throw new Error('Image metadata not found');
    }

    const existingTags = new Set(metadata.tags);
    tags.forEach(tag => existingTags.add(tag));
    
    await this.metadataService.updateMetadata(imageId, {
      tags: Array.from(existingTags)
    });
  }

  /**
   * Remove tags from image
   */
  async removeImageTags(imageId: string, tags: string[]): Promise<void> {
    const metadata = await this.metadataService.getMetadata(imageId);
    if (!metadata) {
      throw new Error('Image metadata not found');
    }

    const updatedTags = metadata.tags.filter(tag => !tags.includes(tag));
    
    await this.metadataService.updateMetadata(imageId, {
      tags: updatedTags
    });
  }

  /**
   * Update image visibility
   */
  async updateImageVisibility(imageId: string, visibility: 'public' | 'private' | 'unlisted'): Promise<void> {
    await this.metadataService.updateMetadata(imageId, { visibility });
  }

  /**
   * Dispose of WASM resources (cleanup method)
   */
  dispose(): void {
    this.wasmProcessor.dispose();
  }

  private getFileExtension(contentType?: string): string {
    if (!contentType) return '.bin';
    
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/heic': '.heic',
      'image/heif': '.heif',
    };
    
    return mimeToExt[contentType] || '.bin';
  }
}

export function createImageService(env: Bindings): ImageService {
  return new ImageService(env);
}