/**
 * Image Optimization Middleware
 *
 * Edge-side image optimization middleware for real-time processing
 * and intelligent caching with client capability detection.
 */

import { Hono } from 'hono';
import { cache } from 'hono/cache';
import ImageOptimizationPipeline from '../lib/images/imageOptimizationPipeline.js';
import { performanceMonitor } from '../lib/monitoring/performanceMonitor.js';
import { featureFlagManager } from '../lib/infrastructure/featureFlags.js';
import type { Bindings } from '../types.js';

const app = new Hono<{ Bindings: Bindings }>();

interface OptimizationParams {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: string;
  progressive?: boolean;
  auto?: boolean; // Auto-optimize based on client capabilities
}

/**
 * Parse optimization parameters from query string
 */
function parseOptimizationParams(searchParams: URLSearchParams): OptimizationParams {
  return {
    width: searchParams.get('w') ? parseInt(searchParams.get('w')!) : undefined,
    height: searchParams.get('h') ? parseInt(searchParams.get('h')!) : undefined,
    quality: searchParams.get('q') ? parseInt(searchParams.get('q')!) : undefined,
    format: searchParams.get('f') || undefined,
    fit: (searchParams.get('fit') as any) || 'cover',
    position: searchParams.get('pos') || 'center',
    progressive: searchParams.get('progressive') === 'true',
    auto: searchParams.get('auto') !== 'false', // Default to true
  };
}

/**
 * Generate cache key for optimized image
 */
function generateImageCacheKey(
  imageId: string,
  params: OptimizationParams,
  clientCapabilities: any,
): string {
  const paramString = [
    params.width && `w${params.width}`,
    params.height && `h${params.height}`,
    params.quality && `q${params.quality}`,
    params.format && `f${params.format}`,
    params.fit !== 'cover' && `fit${params.fit}`,
    params.position !== 'center' && `pos${params.position}`,
    params.progressive && 'prog',
    clientCapabilities.supportsWebP && 'webp',
    clientCapabilities.supportsAVIF && 'avif',
  ]
    .filter(Boolean)
    .join('_');

  return `img_${imageId}_${paramString}`;
}

/**
 * Main image optimization middleware
 */
app.get('/optimize/:imageId', async (c) => {
  const imageId = c.req.param('imageId');
  const searchParams = new URL(c.req.url).searchParams;
  const params = parseOptimizationParams(searchParams);

  return performanceMonitor.measureOperation('image_optimization_request', async () => {
    try {
      // Detect client capabilities
      const clientCapabilities = detectClientCapabilities(c.req.raw);

      // Check feature flags
      const userContext = { userId: c.req.header('x-user-id') || 'anonymous' };
      const shouldUseWasm = featureFlagManager.isEnabled('wasm_image_processing', userContext);
      const enableAdvancedOptimization = featureFlagManager.isEnabled(
        'advanced_image_optimization',
        userContext,
      );

      // Generate cache key
      const cacheKey = generateImageCacheKey(imageId, params, clientCapabilities);

      // Check edge cache first
      const cached = await getCachedOptimizedImage(cacheKey, c.env);
      if (cached) {
        performanceMonitor.increment('image_cache_hits');
        return serveCachedImage(c, cached, cacheKey);
      }

      performanceMonitor.increment('image_cache_misses');

      // Initialize optimization pipeline
      const pipeline = new ImageOptimizationPipeline(c.env, {
        enableWasmProcessing: shouldUseWasm,
        enableSharpFallback: true,
        enableWebPConversion: clientCapabilities.supportsWebP,
        enableAVIFConversion: clientCapabilities.supportsAVIF && enableAdvancedOptimization,
      });

      // Apply auto-optimization if enabled
      let optimizedParams = params;
      if (params.auto) {
        optimizedParams = await applyAutoOptimization(
          params,
          clientCapabilities,
          imageId,
          pipeline,
        );
      }

      // Generate optimized variant
      const result = await pipeline.generateOptimizedVariant(imageId, {
        ...optimizedParams,
        clientCapabilities,
      });

      // Cache the result
      await cacheOptimizedImage(cacheKey, result, c.env);

      // Return optimized image
      return serveOptimizedImage(c, result, cacheKey);
    } catch (error) {
      console.error('Image optimization failed:', error);
      performanceMonitor.increment('image_optimization_errors');

      // Fallback to original image
      return serveOriginalImage(c, imageId);
    }
  });
});

/**
 * Batch optimization endpoint
 */
app.post('/batch-optimize', async (c) => {
  try {
    const { imageIds, options = {} } = await c.req.json();

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return c.json({ error: 'Invalid imageIds array' }, 400);
    }

    if (imageIds.length > 100) {
      return c.json({ error: 'Maximum 100 images per batch' }, 400);
    }

    const pipeline = new ImageOptimizationPipeline(c.env);

    const results = await pipeline.bulkOptimize(imageIds, {
      maxConcurrency: 5,
      progressCallback: (progress, completed, total) => {
        console.log(`Batch optimization progress: ${progress.toFixed(1)}% (${completed}/${total})`);
      },
    });

    // Convert Map to object for JSON response
    const resultsObject = Object.fromEntries(results.entries());

    return c.json({
      success: true,
      processedCount: results.size,
      results: resultsObject,
    });
  } catch (error) {
    console.error('Batch optimization failed:', error);
    return c.json({ error: 'Batch optimization failed' }, 500);
  }
});

/**
 * Get optimization recommendations for an image
 */
app.get('/recommendations/:imageId', async (c) => {
  try {
    const imageId = c.req.param('imageId');
    const pipeline = new ImageOptimizationPipeline(c.env);

    const recommendations = await pipeline.getOptimizationRecommendations(imageId);

    return c.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error('Failed to get optimization recommendations:', error);
    return c.json({ error: 'Failed to get recommendations' }, 500);
  }
});

/**
 * Real-time optimization status endpoint
 */
app.get('/status/:imageId', async (c) => {
  try {
    const imageId = c.req.param('imageId');

    // This would check the processing queue status
    const status = {
      imageId,
      isProcessing: false,
      queuePosition: 0,
      estimatedTimeRemaining: 0,
      availableVariants: [],
      lastOptimized: null,
    };

    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Failed to get optimization status:', error);
    return c.json({ error: 'Failed to get status' }, 500);
  }
});

/**
 * Webhook for processing completion notifications
 */
app.post('/webhook/processing-complete', async (c) => {
  try {
    const { imageId, jobId, results, error } = await c.req.json();

    if (error) {
      console.error(`Processing failed for image ${imageId}:`, error);
      performanceMonitor.increment('image_processing_webhook_failures');
    } else {
      console.log(
        `Processing completed for image ${imageId}, generated ${results?.length || 0} variants`,
      );
      performanceMonitor.increment('image_processing_webhook_successes');
    }

    // Update cache or database with processing results
    // Notify clients via WebSocket if needed

    return c.json({ success: true, acknowledged: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Helper functions

function detectClientCapabilities(request: Request) {
  const acceptHeader = request.headers.get('accept') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const dpr = request.headers.get('dpr') || '1';
  const viewport = request.headers.get('viewport-width') || '';
  const connectionType = request.headers.get('connection') || '';

  return {
    supportsWebP: acceptHeader.includes('image/webp'),
    supportsAVIF: acceptHeader.includes('image/avif'),
    devicePixelRatio: parseFloat(dpr),
    viewportWidth: viewport ? parseInt(viewport) : null,
    isMobile: userAgent.includes('Mobile'),
    isTablet: userAgent.includes('Tablet'),
    connection: connectionType,
    bandwidthLevel: estimateBandwidthLevel(userAgent, connectionType),
  };
}

function estimateBandwidthLevel(userAgent: string, connection: string): 'low' | 'medium' | 'high' {
  if (userAgent.includes('Mobile') && !connection.includes('WiFi')) {
    return 'low';
  }
  if (connection.includes('keep-alive') || userAgent.includes('Chrome')) {
    return 'high';
  }
  return 'medium';
}

async function applyAutoOptimization(
  params: OptimizationParams,
  clientCapabilities: any,
  imageId: string,
  pipeline: ImageOptimizationPipeline,
): Promise<OptimizationParams> {
  const optimized = { ...params };

  // Auto-format selection
  if (!optimized.format) {
    if (clientCapabilities.supportsAVIF) {
      optimized.format = 'avif';
    } else if (clientCapabilities.supportsWebP) {
      optimized.format = 'webp';
    } else {
      optimized.format = 'jpeg';
    }
  }

  // Auto-quality adjustment based on bandwidth
  if (!optimized.quality) {
    switch (clientCapabilities.bandwidthLevel) {
      case 'low':
        optimized.quality = 60;
        break;
      case 'medium':
        optimized.quality = 75;
        break;
      case 'high':
        optimized.quality = 85;
        break;
    }
  }

  // Auto-sizing based on viewport and device pixel ratio
  if (!optimized.width && clientCapabilities.viewportWidth) {
    const dpr = clientCapabilities.devicePixelRatio || 1;
    optimized.width = Math.min(
      clientCapabilities.viewportWidth * dpr,
      clientCapabilities.isMobile ? 800 : 1920,
    );
  }

  // Progressive loading for slow connections
  if (clientCapabilities.bandwidthLevel === 'low') {
    optimized.progressive = true;
  }

  return optimized;
}

async function getCachedOptimizedImage(cacheKey: string, env: Bindings): Promise<any> {
  try {
    // Check Cloudflare KV cache
    const cached = await env.IMAGE_CACHE?.get(cacheKey, 'arrayBuffer');
    if (cached) {
      return {
        data: cached,
        contentType: 'image/webp', // Would be stored with metadata
        cacheKey,
      };
    }
    return null;
  } catch (error) {
    console.error('Cache lookup failed:', error);
    return null;
  }
}

async function cacheOptimizedImage(cacheKey: string, result: any, env: Bindings): Promise<void> {
  try {
    // Cache in Cloudflare KV with appropriate TTL
    const ttl = 60 * 60 * 24 * 7; // 1 week
    await env.IMAGE_CACHE?.put(cacheKey, result.data, {
      expirationTtl: ttl,
      metadata: {
        contentType: `image/${result.format}`,
        size: result.size,
        dimensions: result.dimensions,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Cache storage failed:', error);
  }
}

function serveCachedImage(c: any, cached: any, cacheKey: string) {
  // Set appropriate cache headers
  c.header('Content-Type', cached.contentType);
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  c.header('ETag', cacheKey);
  c.header('X-Cache', 'HIT');

  return c.body(cached.data);
}

function serveOptimizedImage(c: any, result: any, cacheKey: string) {
  // Set appropriate headers for optimized image
  c.header('Content-Type', `image/${result.format}`);
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  c.header('ETag', cacheKey);
  c.header('X-Cache', 'MISS');
  c.header('X-Processing-Time', `${result.processingTime}ms`);
  c.header('X-Original-Size', result.originalSize?.toString() || '0');
  c.header('X-Optimized-Size', result.size.toString());

  if (result.originalSize) {
    const savings = (((result.originalSize - result.size) / result.originalSize) * 100).toFixed(1);
    c.header('X-Size-Savings', `${savings}%`);
  }

  return c.body(result.data);
}

async function serveOriginalImage(c: any, imageId: string) {
  try {
    // Fallback to serving original image
    const originalUrl = `/api/images/${imageId}`;
    return c.redirect(originalUrl, 302);
  } catch (error) {
    console.error('Failed to serve original image:', error);
    return c.json({ error: 'Image not found' }, 404);
  }
}

export default app;
