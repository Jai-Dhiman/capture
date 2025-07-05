/**
 * Sharp.js Image Processor
 *
 * High-performance server-side image processing using Sharp.js
 * as fallback when WASM processing is unavailable.
 */

import sharp from 'sharp';
import { performanceMonitor } from './performanceMonitor.js';
import type { ProcessingResult } from './imageOptimizationPipeline.js';

export interface SharpProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: string;
  progressive?: boolean;
  compressionLevel?: number;
  effort?: number;
  background?: string;
  extractChannel?: 'red' | 'green' | 'blue' | 'alpha';
  threshold?: number;
  blur?: number;
  sharpen?: boolean;
  removeMetadata?: boolean;
}

export interface SharpMetadata {
  format: string;
  width: number;
  height: number;
  channels: number;
  density: number;
  hasAlpha: boolean;
  size: number;
  space: string;
}

export class SharpImageProcessor {
  private static instance: SharpImageProcessor;

  private constructor() {
    this.configureSharp();
  }

  static getInstance(): SharpImageProcessor {
    if (!SharpImageProcessor.instance) {
      SharpImageProcessor.instance = new SharpImageProcessor();
    }
    return SharpImageProcessor.instance;
  }

  /**
   * Process image with Sharp.js
   */
  async processImage(
    input: Buffer | ArrayBuffer | Uint8Array,
    options: SharpProcessingOptions,
  ): Promise<ProcessingResult> {
    return performanceMonitor.measureOperation('sharp_image_processing', async () => {
      const startTime = Date.now();

      try {
        // Convert input to Buffer if needed
        const inputBuffer =
          input instanceof ArrayBuffer
            ? Buffer.from(input)
            : input instanceof Uint8Array
              ? Buffer.from(input)
              : input;

        // Create Sharp instance
        let pipeline = sharp(inputBuffer);

        // Get input metadata
        const metadata = await pipeline.metadata();

        // Apply transformations
        pipeline = this.applyTransformations(pipeline, options, metadata);

        // Set output format and quality
        pipeline = this.applyOutputSettings(pipeline, options);

        // Execute processing
        const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

        const processingTime = Date.now() - startTime;

        // Record performance metrics
        performanceMonitor.timing('sharp_processing_time', processingTime, {
          format: options.format || 'jpeg',
          width: options.width?.toString() || 'auto',
          height: options.height?.toString() || 'auto',
        });

        performanceMonitor.recordMemoryUsage('sharp_memory_usage', data.byteLength, {
          operation: 'image_processing',
        });

        return {
          operation: 'sharp_process',
          outputPath: '', // Will be set by caller
          size: data.byteLength,
          dimensions: { width: info.width, height: info.height },
          format: info.format,
          quality: options.quality || 85,
          processingTime,
          data: data,
        };
      } catch (error) {
        console.error('Sharp processing failed:', error);
        performanceMonitor.increment('sharp_processing_errors');
        throw new Error(`Image processing failed: ${error.message}`);
      }
    });
  }

  /**
   * Generate multiple variants in a single pass
   */
  async generateVariants(
    input: Buffer | ArrayBuffer | Uint8Array,
    variants: Array<SharpProcessingOptions & { name: string }>,
  ): Promise<ProcessingResult[]> {
    return performanceMonitor.measureOperation('sharp_batch_processing', async () => {
      const inputBuffer =
        input instanceof ArrayBuffer
          ? Buffer.from(input)
          : input instanceof Uint8Array
            ? Buffer.from(input)
            : input;

      const results = await Promise.all(
        variants.map(async (variant) => {
          try {
            const result = await this.processImage(inputBuffer, variant);
            return { ...result, operation: `sharp_${variant.name}` };
          } catch (error) {
            console.error(`Failed to generate variant ${variant.name}:`, error);
            return null;
          }
        }),
      );

      return results.filter((result) => result !== null) as ProcessingResult[];
    });
  }

  /**
   * Extract image metadata
   */
  async extractMetadata(input: Buffer | ArrayBuffer | Uint8Array): Promise<SharpMetadata> {
    try {
      const inputBuffer =
        input instanceof ArrayBuffer
          ? Buffer.from(input)
          : input instanceof Uint8Array
            ? Buffer.from(input)
            : input;

      const metadata = await sharp(inputBuffer).metadata();

      return {
        format: metadata.format || 'unknown',
        width: metadata.width || 0,
        height: metadata.height || 0,
        channels: metadata.channels || 0,
        density: metadata.density || 72,
        hasAlpha: metadata.hasAlpha || false,
        size: metadata.size || 0,
        space: metadata.space || 'srgb',
      };
    } catch (error) {
      console.error('Failed to extract metadata:', error);
      throw new Error(`Metadata extraction failed: ${error.message}`);
    }
  }

  /**
   * Optimize image for web delivery
   */
  async optimizeForWeb(
    input: Buffer | ArrayBuffer | Uint8Array,
    options: {
      targetSize?: number; // Target file size in bytes
      maxWidth?: number;
      maxHeight?: number;
      preferredFormat?: 'webp' | 'avif' | 'jpeg';
      qualityRange?: { min: number; max: number };
    } = {},
  ): Promise<ProcessingResult> {
    const {
      targetSize,
      maxWidth = 1920,
      maxHeight = 1920,
      preferredFormat = 'webp',
      qualityRange = { min: 60, max: 90 },
    } = options;

    return performanceMonitor.measureOperation('sharp_web_optimization', async () => {
      const inputBuffer =
        input instanceof ArrayBuffer
          ? Buffer.from(input)
          : input instanceof Uint8Array
            ? Buffer.from(input)
            : input;

      const metadata = await this.extractMetadata(inputBuffer);

      // Calculate optimal dimensions
      const { width, height } = this.calculateOptimalDimensions(
        metadata.width,
        metadata.height,
        maxWidth,
        maxHeight,
      );

      let quality = qualityRange.max;
      let result: ProcessingResult;

      // Iteratively reduce quality to meet target size
      if (targetSize) {
        do {
          result = await this.processImage(inputBuffer, {
            width,
            height,
            format: preferredFormat,
            quality,
            progressive: true,
            removeMetadata: true,
          });

          if (result.size <= targetSize || quality <= qualityRange.min) {
            break;
          }

          quality = Math.max(quality - 5, qualityRange.min);
        } while (quality >= qualityRange.min);
      } else {
        result = await this.processImage(inputBuffer, {
          width,
          height,
          format: preferredFormat,
          quality,
          progressive: true,
          removeMetadata: true,
        });
      }

      return result;
    });
  }

  /**
   * Generate responsive image variants
   */
  async generateResponsiveVariants(
    input: Buffer | ArrayBuffer | Uint8Array,
    breakpoints: number[] = [320, 640, 960, 1280, 1920],
    format: 'webp' | 'avif' | 'jpeg' = 'webp',
  ): Promise<ProcessingResult[]> {
    const inputBuffer =
      input instanceof ArrayBuffer
        ? Buffer.from(input)
        : input instanceof Uint8Array
          ? Buffer.from(input)
          : input;

    const metadata = await this.extractMetadata(inputBuffer);

    const variants = breakpoints
      .filter((width) => width <= metadata.width) // Only generate smaller variants
      .map((width) => ({
        name: `responsive_${width}w`,
        width,
        format,
        quality: 85,
        progressive: true,
        removeMetadata: true,
      }));

    return this.generateVariants(inputBuffer, variants);
  }

  /**
   * Create image thumbnails
   */
  async generateThumbnails(
    input: Buffer | ArrayBuffer | Uint8Array,
    sizes: Array<{ width: number; height: number; name: string }> = [
      { width: 150, height: 150, name: 'thumb_small' },
      { width: 300, height: 300, name: 'thumb_medium' },
      { width: 600, height: 600, name: 'thumb_large' },
    ],
  ): Promise<ProcessingResult[]> {
    const inputBuffer =
      input instanceof ArrayBuffer
        ? Buffer.from(input)
        : input instanceof Uint8Array
          ? Buffer.from(input)
          : input;

    const variants = sizes.map((size) => ({
      ...size,
      format: 'webp' as const,
      fit: 'cover' as const,
      quality: 80,
      removeMetadata: true,
    }));

    return this.generateVariants(inputBuffer, variants);
  }

  /**
   * Apply advanced image filters
   */
  async applyFilters(
    input: Buffer | ArrayBuffer | Uint8Array,
    filters: {
      blur?: number;
      sharpen?: boolean;
      brightness?: number;
      contrast?: number;
      saturation?: number;
      hue?: number;
      gamma?: number;
      normalize?: boolean;
      grayscale?: boolean;
    },
  ): Promise<ProcessingResult> {
    const inputBuffer =
      input instanceof ArrayBuffer
        ? Buffer.from(input)
        : input instanceof Uint8Array
          ? Buffer.from(input)
          : input;

    let pipeline = sharp(inputBuffer);

    // Apply filters
    if (filters.blur) {
      pipeline = pipeline.blur(filters.blur);
    }

    if (filters.sharpen) {
      pipeline = pipeline.sharpen();
    }

    if (filters.brightness || filters.contrast || filters.saturation || filters.hue) {
      pipeline = pipeline.modulate({
        brightness: filters.brightness,
        contrast: filters.contrast,
        saturation: filters.saturation,
        hue: filters.hue,
      });
    }

    if (filters.gamma) {
      pipeline = pipeline.gamma(filters.gamma);
    }

    if (filters.normalize) {
      pipeline = pipeline.normalize();
    }

    if (filters.grayscale) {
      pipeline = pipeline.grayscale();
    }

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      operation: 'sharp_filters',
      outputPath: '',
      size: data.byteLength,
      dimensions: { width: info.width, height: info.height },
      format: info.format,
      quality: 100, // Filters don't change quality setting
      processingTime: 0, // Would be measured by caller
      data: data,
    };
  }

  // Private methods

  private configureSharp(): void {
    try {
      // Configure Sharp for optimal performance
      sharp.cache({
        memory: 100, // 100MB memory cache
        files: 20, // 20 file descriptors
        items: 200, // 200 cached items
      });

      sharp.concurrency(4); // Limit concurrent operations

      console.log('Sharp.js configured successfully');
    } catch (error) {
      console.error('Failed to configure Sharp.js:', error);
    }
  }

  private applyTransformations(
    pipeline: sharp.Sharp,
    options: SharpProcessingOptions,
    metadata: sharp.Metadata,
  ): sharp.Sharp {
    // Resize if dimensions specified
    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width,
        height: options.height,
        fit: this.convertFitOption(options.fit),
        position: this.convertPositionOption(options.position),
        background: options.background || { r: 255, g: 255, b: 255, alpha: 1 },
      });
    }

    // Extract specific channel
    if (options.extractChannel) {
      pipeline = pipeline.extractChannel(options.extractChannel);
    }

    // Apply threshold
    if (options.threshold !== undefined) {
      pipeline = pipeline.threshold(options.threshold);
    }

    // Apply blur
    if (options.blur) {
      pipeline = pipeline.blur(options.blur);
    }

    // Apply sharpening
    if (options.sharpen) {
      pipeline = pipeline.sharpen();
    }

    // Remove metadata if requested
    if (options.removeMetadata) {
      pipeline = pipeline.removeProfile();
    }

    return pipeline;
  }

  private applyOutputSettings(pipeline: sharp.Sharp, options: SharpProcessingOptions): sharp.Sharp {
    const format = options.format || 'jpeg';
    const quality = options.quality || 85;

    switch (format) {
      case 'jpeg':
        return pipeline.jpeg({
          quality,
          progressive: options.progressive || false,
          mozjpeg: true, // Use mozjpeg for better compression
        });

      case 'png':
        return pipeline.png({
          compressionLevel: options.compressionLevel || 6,
          progressive: options.progressive || false,
          quality,
        });

      case 'webp':
        return pipeline.webp({
          quality,
          effort: options.effort || 4,
          progressive: options.progressive || false,
        });

      case 'avif':
        return pipeline.avif({
          quality,
          effort: options.effort || 4,
          progressive: options.progressive || false,
        });

      case 'tiff':
        return pipeline.tiff({
          quality,
          compression: 'lzw',
        });

      default:
        return pipeline.jpeg({ quality, progressive: options.progressive || false });
    }
  }

  private convertFitOption(fit?: string): sharp.FitEnum {
    switch (fit) {
      case 'contain':
        return sharp.fit.contain;
      case 'fill':
        return sharp.fit.fill;
      case 'inside':
        return sharp.fit.inside;
      case 'outside':
        return sharp.fit.outside;
      case 'cover':
      default:
        return sharp.fit.cover;
    }
  }

  private convertPositionOption(position?: string): sharp.PositionEnum {
    switch (position) {
      case 'top':
        return sharp.position.top;
      case 'bottom':
        return sharp.position.bottom;
      case 'left':
        return sharp.position.left;
      case 'right':
        return sharp.position.right;
      case 'center':
      default:
        return sharp.position.center;
    }
  }

  private calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number,
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    // Scale down if larger than max dimensions
    if (width > maxWidth) {
      width = maxWidth;
      height = Math.round(width / aspectRatio);
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = Math.round(height * aspectRatio);
    }

    return { width, height };
  }

  dispose(): void {
    // Clean up Sharp cache
    sharp.cache(false);
  }
}

// Export singleton instance
export const sharpImageProcessor = SharpImageProcessor.getInstance();
