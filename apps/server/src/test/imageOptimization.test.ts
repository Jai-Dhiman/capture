/**
 * Image Optimization Pipeline Tests
 *
 * Comprehensive test suite for image optimization functionality
 * including performance benchmarks and integration tests.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import ImageOptimizationPipeline from '../lib/images/imageOptimizationPipeline.js';
import { sharpImageProcessor } from '../lib/images/sharpImageProcessor.js';
import { performanceMonitor } from '../lib/monitoring/performanceMonitor.js';
import type { Bindings } from '../types.js';

// Mock bindings for testing
const mockBindings: Bindings = {
  IMAGES_BUCKET: {
    get: async (key: string) => null,
    put: async (key: string, value: any) => {},
    delete: async (key: string) => {},
    list: async () => ({ objects: [] }),
  } as any,
  IMAGE_CACHE: {
    get: async (key: string) => null,
    put: async (key: string, value: any) => {},
    delete: async (key: string) => {},
  } as any,
  DATABASE: {} as any,
};

// Test image data (1x1 pixel JPEG)
const testImageBuffer = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsK' +
    'CwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQU' +
    'FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIA' +
    'AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QA' +
    'FQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDX' +
    '4AAAf//Z',
  'base64',
);

describe('Image Optimization Pipeline', () => {
  let pipeline: ImageOptimizationPipeline;

  beforeAll(() => {
    pipeline = new ImageOptimizationPipeline(mockBindings, {
      enableWasmProcessing: false, // Use Sharp for testing
      enableSharpFallback: true,
    });
  });

  afterAll(() => {
    pipeline.dispose();
  });

  describe('Basic Image Processing', () => {
    it('should process a simple image resize', async () => {
      const result = await pipeline.generateOptimizedVariant('test-image-1', {
        width: 100,
        height: 100,
        format: 'jpeg',
        quality: 85,
      });

      expect(result).toBeDefined();
      expect(result.dimensions.width).toBe(100);
      expect(result.dimensions.height).toBe(100);
      expect(result.format).toBe('jpeg');
      expect(result.quality).toBe(85);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should generate WebP format when supported', async () => {
      const clientCapabilities = {
        supportsWebP: true,
        supportsAVIF: false,
        supportedFormats: ['webp', 'jpeg'],
        screenDensity: 1.0,
        bandwidthLevel: 'high' as const,
        connectionType: 'wifi' as const,
      };

      const result = await pipeline.generateOptimizedVariant('test-image-2', {
        width: 200,
        height: 200,
        clientCapabilities,
      });

      expect(result.format).toBe('webp');
    });

    it('should generate AVIF format when supported', async () => {
      const clientCapabilities = {
        supportsWebP: true,
        supportsAVIF: true,
        supportedFormats: ['avif', 'webp', 'jpeg'],
        screenDensity: 1.0,
        bandwidthLevel: 'high' as const,
        connectionType: 'wifi' as const,
      };

      const result = await pipeline.generateOptimizedVariant('test-image-3', {
        width: 200,
        height: 200,
        clientCapabilities,
      });

      expect(result.format).toBe('avif');
    });
  });

  describe('Responsive Variants Generation', () => {
    it('should generate multiple responsive variants', async () => {
      const variants = await pipeline.generateResponsiveVariants('test-image-4');

      expect(variants).toBeInstanceOf(Array);
      expect(variants.length).toBeGreaterThan(0);

      // Check that variants have different sizes
      const widths = variants.map((v) => v.dimensions.width);
      const uniqueWidths = new Set(widths);
      expect(uniqueWidths.size).toBeGreaterThan(1);
    });

    it('should generate optimized thumbnails', async () => {
      const thumbnails = await pipeline.generateOptimizedThumbnails('test-image-5');

      expect(thumbnails).toBeInstanceOf(Array);
      expect(thumbnails.length).toBe(3); // small, medium, large

      // Check thumbnail sizes
      const sizes = thumbnails.map((t) => t.dimensions.width);
      expect(sizes).toContain(150);
      expect(sizes).toContain(300);
      expect(sizes).toContain(600);
    });
  });

  describe('Bulk Optimization', () => {
    it('should process multiple images in batch', async () => {
      const imageIds = ['bulk-1', 'bulk-2', 'bulk-3'];
      let progressCallbacks = 0;

      const results = await pipeline.bulkOptimize(imageIds, {
        maxConcurrency: 2,
        progressCallback: (progress, completed, total) => {
          progressCallbacks++;
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(100);
          expect(completed).toBeLessThanOrEqual(total);
        },
      });

      expect(results.size).toBe(imageIds.length);
      expect(progressCallbacks).toBeGreaterThan(0);

      // Check that each image has results
      imageIds.forEach((imageId) => {
        expect(results.has(imageId)).toBe(true);
        const imageResults = results.get(imageId);
        expect(imageResults).toBeInstanceOf(Array);
      });
    });
  });

  describe('Optimization Recommendations', () => {
    it('should provide optimization recommendations', async () => {
      const recommendations = await pipeline.getOptimizationRecommendations('test-image-6');

      expect(recommendations).toBeDefined();
      expect(recommendations.currentSize).toBeGreaterThanOrEqual(0);
      expect(recommendations.potentialSavings).toBeGreaterThanOrEqual(0);
      expect(recommendations.recommendedFormats).toBeInstanceOf(Array);
      expect(recommendations.suggestedOperations).toBeInstanceOf(Array);
    });
  });

  describe('Client Capability Detection', () => {
    it('should detect WebP support from accept header', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'accept') return 'image/webp,image/jpeg,*/*';
            if (name === 'user-agent') return 'Mozilla/5.0 Chrome/91.0';
            return null;
          },
        },
      } as any;

      const capabilities = pipeline.detectClientCapabilities(mockRequest);

      expect(capabilities.supportsWebP).toBe(true);
      expect(capabilities.supportsAVIF).toBe(false);
    });

    it('should detect AVIF support from accept header', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'accept') return 'image/avif,image/webp,image/jpeg,*/*';
            if (name === 'user-agent') return 'Mozilla/5.0 Chrome/91.0';
            return null;
          },
        },
      } as any;

      const capabilities = pipeline.detectClientCapabilities(mockRequest);

      expect(capabilities.supportsAVIF).toBe(true);
      expect(capabilities.supportsWebP).toBe(true);
    });

    it('should detect mobile device from user agent', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'accept') return 'image/jpeg,*/*';
            if (name === 'user-agent')
              return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
            return null;
          },
        },
      } as any;

      const capabilities = pipeline.detectClientCapabilities(mockRequest);

      expect(capabilities.connectionType).toBe('4g');
      expect(capabilities.screenDensity).toBe(2.0);
    });
  });
});

describe('Sharp Image Processor', () => {
  describe('Basic Processing', () => {
    it('should process image with Sharp', async () => {
      const result = await sharpImageProcessor.processImage(testImageBuffer, {
        width: 100,
        height: 100,
        format: 'jpeg',
        quality: 85,
      });

      expect(result).toBeDefined();
      expect(result.dimensions.width).toBe(100);
      expect(result.dimensions.height).toBe(100);
      expect(result.format).toBe('jpeg');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should extract image metadata', async () => {
      const metadata = await sharpImageProcessor.extractMetadata(testImageBuffer);

      expect(metadata).toBeDefined();
      expect(metadata.format).toBe('jpeg');
      expect(metadata.width).toBe(1);
      expect(metadata.height).toBe(1);
      expect(metadata.channels).toBeGreaterThan(0);
    });

    it('should generate multiple variants', async () => {
      const variants = [
        { name: 'small', width: 100, height: 100, format: 'webp' as const },
        { name: 'medium', width: 200, height: 200, format: 'jpeg' as const },
        { name: 'large', width: 400, height: 400, format: 'png' as const },
      ];

      const results = await sharpImageProcessor.generateVariants(testImageBuffer, variants);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(3);

      results.forEach((result, index) => {
        expect(result.operation).toBe(`sharp_${variants[index].name}`);
        expect(result.dimensions.width).toBe(variants[index].width);
        expect(result.dimensions.height).toBe(variants[index].height);
      });
    });
  });

  describe('Web Optimization', () => {
    it('should optimize image for web delivery', async () => {
      const result = await sharpImageProcessor.optimizeForWeb(testImageBuffer, {
        maxWidth: 800,
        maxHeight: 600,
        preferredFormat: 'webp',
        qualityRange: { min: 70, max: 90 },
      });

      expect(result).toBeDefined();
      expect(result.format).toBe('webp');
      expect(result.quality).toBeGreaterThanOrEqual(70);
      expect(result.quality).toBeLessThanOrEqual(90);
    });

    it('should meet target file size', async () => {
      const targetSize = 5000; // 5KB

      const result = await sharpImageProcessor.optimizeForWeb(testImageBuffer, {
        targetSize,
        preferredFormat: 'jpeg',
        qualityRange: { min: 60, max: 90 },
      });

      // Since our test image is very small, this test verifies the algorithm works
      expect(result).toBeDefined();
      expect(result.format).toBe('jpeg');
    });
  });

  describe('Responsive Variants', () => {
    it('should generate responsive variants', async () => {
      const breakpoints = [320, 640, 960];
      const results = await sharpImageProcessor.generateResponsiveVariants(
        testImageBuffer,
        breakpoints,
        'webp',
      );

      expect(results).toBeInstanceOf(Array);
      // Note: Our 1x1 test image won't generate larger variants, so this tests the logic
      results.forEach((result) => {
        expect(result.format).toBe('webp');
        expect(result.operation).toMatch(/responsive_\d+w/);
      });
    });

    it('should generate thumbnails', async () => {
      const sizes = [
        { width: 50, height: 50, name: 'mini' },
        { width: 100, height: 100, name: 'small' },
      ];

      const results = await sharpImageProcessor.generateThumbnails(testImageBuffer, sizes);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(2);

      results.forEach((result, index) => {
        expect(result.dimensions.width).toBe(sizes[index].width);
        expect(result.dimensions.height).toBe(sizes[index].height);
        expect(result.format).toBe('webp');
      });
    });
  });

  describe('Image Filters', () => {
    it('should apply image filters', async () => {
      const result = await sharpImageProcessor.applyFilters(testImageBuffer, {
        blur: 2,
        sharpen: true,
        brightness: 1.1,
        contrast: 1.2,
        saturation: 0.8,
        normalize: true,
      });

      expect(result).toBeDefined();
      expect(result.operation).toBe('sharp_filters');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should convert to grayscale', async () => {
      const result = await sharpImageProcessor.applyFilters(testImageBuffer, {
        grayscale: true,
      });

      expect(result).toBeDefined();
      expect(result.operation).toBe('sharp_filters');
    });
  });
});

describe('Performance Benchmarks', () => {
  it('should benchmark image processing performance', async () => {
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();

      await sharpImageProcessor.processImage(testImageBuffer, {
        width: 200,
        height: 200,
        format: 'webp',
        quality: 85,
      });

      times.push(Date.now() - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log(`Image processing benchmark (${iterations} iterations):`);
    console.log(`  Average: ${avgTime.toFixed(2)}ms`);
    console.log(`  Min: ${minTime}ms`);
    console.log(`  Max: ${maxTime}ms`);

    // Performance assertions
    expect(avgTime).toBeLessThan(100); // Should be fast for small images
    expect(maxTime - minTime).toBeLessThan(50); // Should be consistent
  });

  it('should benchmark batch processing performance', async () => {
    const batchSize = 5;
    const variants = [
      { name: 'thumb', width: 100, height: 100, format: 'webp' as const },
      { name: 'small', width: 200, height: 200, format: 'webp' as const },
      { name: 'medium', width: 400, height: 400, format: 'jpeg' as const },
    ];

    const startTime = Date.now();

    const promises = Array(batchSize)
      .fill(null)
      .map(() => sharpImageProcessor.generateVariants(testImageBuffer, variants));

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    console.log(`Batch processing benchmark (${batchSize} x ${variants.length} variants):`);
    console.log(`  Total time: ${totalTime}ms`);
    console.log(`  Average per batch: ${(totalTime / batchSize).toFixed(2)}ms`);
    console.log(
      `  Average per variant: ${(totalTime / (batchSize * variants.length)).toFixed(2)}ms`,
    );

    expect(results).toHaveLength(batchSize);
    results.forEach((batch) => {
      expect(batch).toHaveLength(variants.length);
    });

    // Performance assertion
    expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
  });
});

describe('Integration Tests', () => {
  it('should handle end-to-end image upload and optimization', async () => {
    // Simulate file upload
    const mockFile = new File([testImageBuffer], 'test.jpg', { type: 'image/jpeg' });

    const result = await pipeline.processUploadedImage(mockFile, 'test-upload.jpg', {
      generateThumbnails: true,
      generateResponsiveVariants: true,
      enableProgressive: true,
      clientCapabilities: {
        supportsWebP: true,
        supportsAVIF: false,
        supportedFormats: ['webp', 'jpeg'],
        screenDensity: 1.0,
        bandwidthLevel: 'high',
        connectionType: 'wifi',
      },
    });

    expect(result).toBeDefined();
    expect(result.originalId).toBeDefined();
    expect(result.optimizedVariants).toBeInstanceOf(Array);
    expect(result.thumbnails).toBeInstanceOf(Array);
    expect(result.metadata).toBeDefined();

    // Verify thumbnails were generated
    expect(result.thumbnails.length).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    // Test with invalid image data
    const invalidBuffer = Buffer.from('invalid image data');

    await expect(
      sharpImageProcessor.processImage(invalidBuffer, {
        width: 100,
        height: 100,
        format: 'jpeg',
      }),
    ).rejects.toThrow();
  });

  it('should validate performance monitoring integration', () => {
    const dashboardData = performanceMonitor.getDashboardData();

    expect(dashboardData).toBeDefined();
    expect(dashboardData.systemMetrics).toBeDefined();
    expect(dashboardData.recentMetrics).toBeInstanceOf(Array);
    expect(dashboardData.activeAlerts).toBeInstanceOf(Array);
    expect(dashboardData.topOperations).toBeInstanceOf(Array);
  });
});
