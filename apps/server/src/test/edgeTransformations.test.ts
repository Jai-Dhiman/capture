import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import {
  createEdgeTransformationService,
  createAdvancedCachingService,
  extractTransformationOptions,
  EdgeTransformations,
} from '../lib/cache/edgeTransformations';
import { createAdvancedCachingService as createAdvanced } from '../lib/cache/advancedCachingService';
import type { Bindings } from '../types';

// Mock Bindings
const mockBindings: Bindings = {
  CACHE_KV: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  } as any,
  CLOUDFLARE_ACCOUNT_HASH: 'test-hash',
  CLOUDFLARE_IMAGES_TOKEN: 'test-token',
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  CLOUDFLARE_IMAGES_KEY: 'test-key',
} as any;

describe('Edge Transformations', () => {
  let transformationService: ReturnType<typeof createEdgeTransformationService>;

  beforeEach(() => {
    vi.clearAllMocks();
    transformationService = createEdgeTransformationService(mockBindings);
  });

  describe('Image Transformations', () => {
    it('should transform image URL with Cloudflare Images', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const options = {
        width: 300,
        height: 200,
        quality: 85,
        format: 'webp' as const,
        fit: 'cover' as const,
      };

      const result = await transformationService.transformImage(imageUrl, options);
      
      expect(result).toContain('imagedelivery.net');
      expect(result).toContain('test-hash');
      expect(result).toContain('width=300');
      expect(result).toContain('height=200');
      expect(result).toContain('quality=85');
      expect(result).toContain('format=webp');
      expect(result).toContain('fit=cover');
    });

    it('should fallback to original URL when Cloudflare config is missing', async () => {
      const serviceWithoutConfig = createEdgeTransformationService({
        ...mockBindings,
        CLOUDFLARE_ACCOUNT_HASH: undefined,
      } as any);

      const imageUrl = 'https://example.com/image.jpg';
      const result = await serviceWithoutConfig.transformImage(imageUrl, {});
      
      expect(result).toBe(imageUrl);
    });

    it('should handle transformation errors gracefully', async () => {
      const imageUrl = 'invalid-url';
      const result = await transformationService.transformImage(imageUrl, {
        width: 300,
      });
      
      expect(result).toBe(imageUrl);
    });
  });

  describe('Content Transformations', () => {
    it('should minify content when requested', async () => {
      const content = `
        <html>
          <!-- This is a comment -->
          <body>
            <h1>  Hello   World  </h1>
          </body>
        </html>
      `;

      const result = await transformationService.transformContent(content, {
        minify: true,
      });

      expect(result).not.toContain('<!--');
      expect(result).not.toContain('  ');
      expect(result.trim()).toBeTruthy();
    });

    it('should preserve content when no transformations requested', async () => {
      const content = 'Hello World';
      const result = await transformationService.transformContent(content, {});
      
      expect(result).toBe(content);
    });
  });

  describe('Content Personalization', () => {
    it('should add personalization metadata', async () => {
      const content = { title: 'Test Post', body: 'Content' };
      const options = {
        userId: 'user123',
        userAgent: 'Mozilla/5.0 (iPhone)',
        acceptLanguage: 'en-US,en;q=0.9',
      };

      const result = await transformationService.personalizeContent(content, options);

      expect(result._personalized).toBe(true);
      expect(result._userId).toBe('user123');
      expect(result._mobileOptimized).toBe(true);
      expect(result._locale).toBe('en-US');
      expect(result.title).toBe('Test Post');
    });

    it('should return original content when no userId provided', async () => {
      const content = { title: 'Test Post' };
      const result = await transformationService.personalizeContent(content, {});
      
      expect(result).toEqual(content);
    });
  });

  describe('A/B Testing', () => {
    it('should apply A/B test metadata', async () => {
      const content = { title: 'Test Post' };
      const options = {
        experimentId: 'test_experiment',
        variant: 'variant_a',
      };

      const result = await transformationService.handleABTest(content, options);

      expect(result._experiment).toBeDefined();
      expect(result._experiment.id).toBe('test_experiment');
      expect(result._experiment.variant).toBe('variant_a');
      expect(result._variantA).toBe(true);
    });

    it('should apply control variant', async () => {
      const content = { title: 'Test Post' };
      const options = {
        experimentId: 'test_experiment',
        variant: 'control',
      };

      const result = await transformationService.handleABTest(content, options);

      expect(result._control).toBe(true);
    });

    it('should return original content when no experiment provided', async () => {
      const content = { title: 'Test Post' };
      const result = await transformationService.handleABTest(content, {});
      
      expect(result).toEqual(content);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate cache key with transformation parameters', () => {
      const originalKey = 'test_key';
      const options = {
        width: 300,
        height: 200,
        quality: 85,
        userId: 'user123',
        variant: 'variant_a',
      };

      const cacheKey = transformationService.getCacheKey(originalKey, options);

      expect(cacheKey).toContain('test_key');
      expect(cacheKey).toContain('w300');
      expect(cacheKey).toContain('h200');
      expect(cacheKey).toContain('q85');
      expect(cacheKey).toContain('uuser123');
      expect(cacheKey).toContain('varvariant_a');
    });

    it('should handle mobile user agent in cache key', () => {
      const originalKey = 'test_key';
      const options = {
        userAgent: 'Mozilla/5.0 (iPhone)',
      };

      const cacheKey = transformationService.getCacheKey(originalKey, options);

      expect(cacheKey).toContain('mobile');
    });

    it('should generate simple key when no options provided', () => {
      const originalKey = 'test_key';
      const cacheKey = transformationService.getCacheKey(originalKey, {});

      expect(cacheKey).toBe(originalKey);
    });
  });

  describe('Request Option Extraction', () => {
    it('should extract transformation options from URL parameters', () => {
      const request = new Request('https://example.com/api/test?w=300&h=200&q=85&f=webp&fit=cover&userId=user123&variant=test_a');
      
      const options = extractTransformationOptions(request);

      expect(options.width).toBe(300);
      expect(options.height).toBe(200);
      expect(options.quality).toBe(85);
      expect(options.format).toBe('webp');
      expect(options.fit).toBe('cover');
      expect(options.userId).toBe('user123');
      expect(options.variant).toBe('test_a');
    });

    it('should extract user agent and language from headers', () => {
      const request = new Request('https://example.com/api/test', {
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone)',
          'accept-language': 'en-US,en;q=0.9',
        },
      });
      
      const options = extractTransformationOptions(request);

      expect(options.userAgent).toBe('Mozilla/5.0 (iPhone)');
      expect(options.acceptLanguage).toBe('en-US,en;q=0.9');
    });

    it('should handle missing parameters gracefully', () => {
      const request = new Request('https://example.com/api/test');
      
      const options = extractTransformationOptions(request);

      expect(options.width).toBeUndefined();
      expect(options.height).toBeUndefined();
      expect(options.quality).toBeUndefined();
    });
  });

  describe('Edge Transformation Presets', () => {
    it('should provide correct thumbnail presets', () => {
      expect(EdgeTransformations.thumbnails.small).toEqual({
        width: 150,
        height: 150,
        fit: 'cover',
        quality: 85,
      });

      expect(EdgeTransformations.thumbnails.medium).toEqual({
        width: 300,
        height: 300,
        fit: 'cover',
        quality: 85,
      });

      expect(EdgeTransformations.thumbnails.large).toEqual({
        width: 600,
        height: 600,
        fit: 'cover',
        quality: 90,
      });
    });

    it('should provide optimization presets', () => {
      expect(EdgeTransformations.optimization.mobile).toEqual({
        minify: true,
        compress: true,
      });

      expect(EdgeTransformations.optimization.desktop).toEqual({
        minify: false,
        compress: true,
      });
    });
  });
});

describe('Advanced Caching Service Integration', () => {
  let advancedCachingService: ReturnType<typeof createAdvanced>;
  let mockKV: MockedFunction<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn().mockResolvedValue({ keys: [] }),
    };

    const mockBindingsWithKV = {
      ...mockBindings,
      CACHE_KV: mockKV,
    };

    advancedCachingService = createAdvanced(mockBindingsWithKV);
  });

  describe('Transform and Cache', () => {
    it('should transform and cache content', async () => {
      const key = 'test_content';
      const content = { title: 'Test', body: 'Content' };
      const transformOptions = {
        userId: 'user123',
        variant: 'test_a',
      };

      mockKV.get.mockResolvedValue(null); // Cache miss

      const result = await advancedCachingService.transformAndCache(
        key,
        content,
        transformOptions
      );

      expect(result._personalized).toBe(true);
      expect(result._userId).toBe('user123');
      expect(mockKV.put).toHaveBeenCalled();
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate advanced cache keys', () => {
      const baseKey = 'test_key';
      const options = {
        transformation: {
          width: 300,
          userId: 'user123',
        },
        variant: 'test_a',
        tags: ['performance', 'critical'],
      };

      const cacheKey = advancedCachingService.getCacheKey(baseKey, options);

      expect(cacheKey).toContain('test_key');
      expect(cacheKey).toContain('w300');
      expect(cacheKey).toContain('uuser123');
      expect(cacheKey).toContain('variant:test_a');
      expect(cacheKey).toContain('tags:performance,critical');
    });
  });

  describe('Cache Optimization', () => {
    it('should optimize cache by cleaning old entries', async () => {
      mockKV.list.mockResolvedValue({
        keys: [
          { name: 'metadata:old_key', metadata: { createdTime: Date.now() - 86400000 } },
          { name: 'metadata:new_key', metadata: { createdTime: Date.now() } },
        ],
      });

      mockKV.get
        .mockResolvedValueOnce(JSON.stringify({
          totalRequests: 100,
          topKeys: [
            { key: 'popular_key', hits: 50 },
            { key: 'less_popular_key', hits: 10 },
          ],
        }))
        .mockResolvedValue(JSON.stringify({
          key: 'popular_key',
          ttl: 300,
          createdAt: new Date().toISOString(),
        }));

      const result = await advancedCachingService.optimizeCache();

      expect(result.cleaned).toBeGreaterThanOrEqual(0);
      expect(result.optimized).toBeGreaterThanOrEqual(0);
    });
  });
});