import type { Bindings } from '../types';
import { createCachingService } from '../cache/cachingService';

export interface ImageUploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  generateThumbnails?: boolean;
  blurHash?: boolean;
}

export interface ImageMetadata {
  id: string;
  filename: string;
  size: number;
  width: number;
  height: number;
  format: string;
  blurHash?: string;
  uploadedAt: Date;
  variants: ImageVariant[];
}

export interface ImageVariant {
  width: number;
  height: number;
  format: string;
  size: number;
  url: string;
  key: string;
}

export interface TransformationParams {
  width?: number;
  height?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

export class R2ImageService {
  private r2: R2Bucket;
  private cache: any;
  private cdnDomain: string;

  constructor(bindings: Bindings) {
    this.r2 = bindings.IMAGES_BUCKET; // R2 bucket binding
    this.cache = createCachingService(bindings);
    this.cdnDomain = bindings.CDN_DOMAIN || '';
  }

  /**
   * Upload an image to R2 with optional processing
   */
  async uploadImage(
    file: File | ArrayBuffer,
    filename: string,
    options: ImageUploadOptions = {},
  ): Promise<ImageMetadata> {
    const imageId = this.generateImageId();
    const ext = this.getFileExtension(filename);
    const baseKey = `images/${imageId}`;

    // Upload original file
    const originalKey = `${baseKey}/original.${ext}`;
    await this.r2.put(originalKey, file, {
      httpMetadata: {
        contentType: this.getMimeType(ext),
        cacheControl: 'public, max-age=31536000', // 1 year
      },
      customMetadata: {
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Get image dimensions and generate metadata
    const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const dimensions = await this.getImageDimensions(buffer);

    const metadata: ImageMetadata = {
      id: imageId,
      filename,
      size: buffer.byteLength,
      width: dimensions.width,
      height: dimensions.height,
      format: ext,
      uploadedAt: new Date(),
      variants: [],
    };

    // Generate blur hash if requested
    if (options.blurHash) {
      metadata.blurHash = await this.generateBlurHash(buffer);
    }

    // Generate thumbnails and variants if requested
    if (options.generateThumbnails) {
      const variants = await this.generateImageVariants(buffer, baseKey, ext, options);
      metadata.variants = variants;
    }

    // Store metadata
    const metadataKey = `${baseKey}/metadata.json`;
    await this.r2.put(metadataKey, JSON.stringify(metadata), {
      httpMetadata: {
        contentType: 'application/json',
      },
    });

    // Cache metadata
    await this.cache.set(`image:${imageId}`, metadata, 3600); // 1 hour cache

    return metadata;
  }

  /**
   * Get image with transformations
   */
  async getImage(
    imageId: string,
    params: TransformationParams = {},
  ): Promise<{ data: ArrayBuffer; contentType: string; cacheKey: string } | null> {
    const cacheKey = this.getCacheKey(imageId, params);

    // Check cache first
    const cached = await this.cache.get<ArrayBuffer>(cacheKey);
    if (cached) {
      return {
        data: cached,
        contentType: this.getMimeType(params.format || 'jpeg'),
        cacheKey,
      };
    }

    // Get original image
    const originalKey = `images/${imageId}/original.*`;
    const originalObject = await this.findOriginalImage(imageId);
    if (!originalObject) {
      return null;
    }

    const originalData = await originalObject.arrayBuffer();

    // Apply transformations if needed
    let processedData: ArrayBuffer;
    let outputFormat = params.format || 'jpeg';

    if (this.needsTransformation(params)) {
      processedData = await this.transformImage(originalData, params);
    } else {
      processedData = originalData;
      // Detect original format
      const metadata = await this.getImageMetadata(imageId);
      outputFormat = metadata?.format || 'jpeg';
    }

    const contentType = this.getMimeType(outputFormat);

    // Cache the result
    await this.cache.set(cacheKey, processedData, 86400); // 24 hour cache

    return {
      data: processedData,
      contentType,
      cacheKey,
    };
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(imageId: string): Promise<ImageMetadata | null> {
    // Check cache first
    const cached = await this.cache.get<ImageMetadata>(`image:${imageId}`);
    if (cached) {
      return cached;
    }

    // Get from R2
    const metadataKey = `images/${imageId}/metadata.json`;
    const metadataObject = await this.r2.get(metadataKey);
    if (!metadataObject) {
      return null;
    }

    const metadataText = await metadataObject.text();
    const metadata: ImageMetadata = JSON.parse(metadataText);

    // Cache metadata
    await this.cache.set(`image:${imageId}`, metadata, 3600);

    return metadata;
  }

  /**
   * Delete an image and all its variants
   */
  async deleteImage(imageId: string): Promise<boolean> {
    try {
      // List all objects with the image prefix
      const prefix = `images/${imageId}/`;
      const objects = await this.r2.list({ prefix });

      // Delete all objects
      const deletePromises = objects.objects.map((obj) => this.r2.delete(obj.key));
      await Promise.all(deletePromises);

      // Clear cache
      await this.cache.delete(`image:${imageId}`);
      await this.invalidateImageCache(imageId);

      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }

  /**
   * Generate responsive image URLs
   */
  getResponsiveUrls(
    imageId: string,
    sizes: number[],
  ): Array<{
    width: number;
    url: string;
  }> {
    return sizes.map((width) => ({
      width,
      url: this.getImageUrl(imageId, { width, format: 'webp' }),
    }));
  }

  /**
   * Get optimized image URL
   */
  getImageUrl(imageId: string, params: TransformationParams = {}): string {
    const searchParams = new URLSearchParams();

    if (params.width) searchParams.set('w', params.width.toString());
    if (params.height) searchParams.set('h', params.height.toString());
    if (params.format) searchParams.set('f', params.format);
    if (params.quality) searchParams.set('q', params.quality.toString());
    if (params.fit) searchParams.set('fit', params.fit);
    if (params.position) searchParams.set('pos', params.position);

    const queryString = searchParams.toString();
    const separator = queryString ? '?' : '';

    return `${this.cdnDomain}/images/${imageId}${separator}${queryString}`;
  }

  // Private helper methods

  private generateImageId(): string {
    return crypto.randomUUID();
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || 'jpg';
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      avif: 'image/avif',
      gif: 'image/gif',
    };
    return mimeTypes[extension] || 'image/jpeg';
  }

  private async getImageDimensions(
    buffer: ArrayBuffer,
  ): Promise<{ width: number; height: number }> {
    // This would use the WASM image processing module in a real implementation
    // For now, return placeholder dimensions
    return { width: 1920, height: 1080 };
  }

  private async generateBlurHash(buffer: ArrayBuffer): Promise<string> {
    // This would generate a blur hash using the WASM module
    // For now, return a placeholder
    return 'L6PZfSjE.AyE_3t7t7R**0o#DgR4';
  }

  private async generateImageVariants(
    buffer: ArrayBuffer,
    baseKey: string,
    format: string,
    options: ImageUploadOptions,
  ): Promise<ImageVariant[]> {
    const variants: ImageVariant[] = [];
    const sizes = [150, 300, 600, 1200, 1920]; // Standard sizes

    for (const size of sizes) {
      try {
        // Transform image using WASM module
        const transformedData = await this.transformImage(buffer, {
          width: size,
          format: 'webp',
          quality: options.quality || 85,
        });

        const variantKey = `${baseKey}/variants/${size}w.webp`;

        // Upload variant
        await this.r2.put(variantKey, transformedData, {
          httpMetadata: {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000',
          },
        });

        variants.push({
          width: size,
          height: Math.round(size * 0.75), // Assume 4:3 ratio for placeholder
          format: 'webp',
          size: transformedData.byteLength,
          url: this.getImageUrl(baseKey.split('/')[1], { width: size, format: 'webp' }),
          key: variantKey,
        });
      } catch (error) {
        console.error(`Error generating variant for size ${size}:`, error);
      }
    }

    return variants;
  }

  private async transformImage(
    buffer: ArrayBuffer,
    params: TransformationParams,
  ): Promise<ArrayBuffer> {
    // This would use the WASM image processing module
    // For now, return the original buffer
    return buffer;
  }

  private needsTransformation(params: TransformationParams): boolean {
    return !!(params.width || params.height || params.format || params.quality);
  }

  private async findOriginalImage(imageId: string): Promise<R2Object | null> {
    const extensions = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

    for (const ext of extensions) {
      const key = `images/${imageId}/original.${ext}`;
      const object = await this.r2.get(key);
      if (object) {
        return object;
      }
    }

    return null;
  }

  private getCacheKey(imageId: string, params: TransformationParams): string {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(',');

    return `image:${imageId}:${paramString}`;
  }

  private async invalidateImageCache(imageId: string): Promise<void> {
    // Invalidate all cached versions of this image
    await this.cache.invalidatePattern(`image:${imageId}:*`);
  }

  /**
   * Batch upload images
   */
  async batchUpload(
    files: Array<{ file: File | ArrayBuffer; filename: string }>,
    options: ImageUploadOptions = {},
  ): Promise<ImageMetadata[]> {
    const uploadPromises = files.map(({ file, filename }) =>
      this.uploadImage(file, filename, options),
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalImages: number;
    totalSize: number;
    averageSize: number;
  }> {
    try {
      const list = await this.r2.list({ prefix: 'images/' });

      const totalImages = list.objects.filter((obj) => obj.key.includes('/original.')).length;

      const totalSize = list.objects.reduce((sum, obj) => sum + obj.size, 0);
      const averageSize = totalImages > 0 ? totalSize / totalImages : 0;

      return {
        totalImages,
        totalSize,
        averageSize,
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalImages: 0,
        totalSize: 0,
        averageSize: 0,
      };
    }
  }
}
