import type { Bindings } from '../../types';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { media } from '../../db/schema';
import { nanoid } from 'nanoid';
import { R2_CONFIG } from './r2Config';
import { 
  R2AuthenticationMiddleware, 
  R2RateLimiter, 
  createR2AuthMiddleware,
  createR2RateLimiter 
} from './accessPolicies';
import { createCachingService, CacheKeys, CacheTTL, type CachingService } from '../cache/cachingService';

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
}

export class ImageService {
  private db: ReturnType<typeof drizzle>;
  private r2: R2Bucket;
  private bucketName: string;
  private authMiddleware: R2AuthenticationMiddleware;
  private rateLimiter: R2RateLimiter;
  private cachingService: CachingService;

  constructor(env: Bindings) {
    this.db = drizzle(env.DB);
    this.r2 = env.IMAGE_STORAGE;
    this.bucketName = R2_CONFIG.bucketName;
    this.authMiddleware = createR2AuthMiddleware();
    this.rateLimiter = createR2RateLimiter();
    this.cachingService = createCachingService(env);
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

    return {
      uploadURL,
      id: fileName,
    };
  }

  async getBatchUploadUrls(
    userId: string,
    userRole: string = 'user',
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

  async delete(mediaId: string, userId: string, userRole: string = 'user'): Promise<void> {
    const mediaRecord = await this.findById(mediaId, userId);
    
    if (!mediaRecord) {
      throw new Error('Media not found');
    }

    // Check access permissions
    const accessCheck = await this.authMiddleware.validateDelete(
      userId,
      userRole,
      mediaRecord.storageKey
    );
    
    if (!accessCheck.allowed) {
      throw new Error(accessCheck.reason || 'Access denied');
    }

    // Check rate limit
    const rateLimit = await this.rateLimiter.checkRateLimit(userId, 'delete', 20, 60000); // 20 deletes per minute
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Try again after ${new Date(rateLimit.resetTime).toISOString()}`);
    }

    // Delete from R2
    await this.r2.delete(mediaRecord.storageKey);
    
    // Delete from database
    await this.db
      .delete(media)
      .where(and(eq(media.id, mediaId), eq(media.userId, userId)));

    // Invalidate related cache entries
    await this.cachingService.delete(CacheKeys.media(mediaId));
    await this.cachingService.invalidatePattern(`image_url:${mediaRecord.storageKey}:*`);
    
    // Also purge CDN cache
    await this.purgeCDNCache(mediaRecord.storageKey);
  }

  async processEditedImage(input: ProcessEditedImageInput): Promise<ProcessEditedImageResult> {
    const processedImageId = generateId();
    const variants = [`${processedImageId}-small`, `${processedImageId}-medium`, `${processedImageId}-large`];
    
    // TODO: Implement actual image processing using WASM
    // For now, return placeholder data
    
    return {
      processedImageId,
      variants,
    };
  }

  async optimizeForVariants(processedImageId: string, variants: string[]): Promise<void> {
    // TODO: Implement optimization logic
    // This would typically involve:
    // 1. Resizing images to different dimensions
    // 2. Compressing for different quality levels
    // 3. Converting to different formats (WebP, AVIF, etc.)
    console.log(`Optimizing ${processedImageId} for variants:`, variants);
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