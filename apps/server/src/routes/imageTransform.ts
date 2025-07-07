import type { Bindings, Variables } from '@/types';
import { Hono } from 'hono';
import { createImageService } from '../lib/images/imageService';
import { createImageUrlService } from '../lib/images/urlService';
import { createCachingService, CacheKeys, CacheTTL } from '../lib/cache/cachingService';
import { cors } from 'hono/cors';
import { cdnSecurityHeaders } from '../middleware/security';

const imageTransformRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Create URL service instance
const urlService = createImageUrlService({
  baseUrl: '/images',
  signUrls: true,
  urlTtl: 3600, // 1 hour
  secretKey: 'your-secret-key-here' // Should be from environment
});

// Handle image transformation requests using URL pattern
imageTransformRouter.get('/:id/:params?', cdnSecurityHeaders(), async (c) => {
  const imageId = c.req.param('id');
  const params = c.req.param('params') || '';
  const query = c.req.query();
  
  try {
    // Reconstruct full URL for parsing
    const fullUrl = `/images/${imageId}${params ? `/${params}` : ''}${Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : ''}`;
    
    // Parse URL to extract transformations
    const parsedUrl = urlService.parseUrl(fullUrl);
    
    if (!parsedUrl) {
      return c.json({ error: 'Invalid URL format' }, 400);
    }

    // Validate URL signature if signing is enabled
    if (!urlService.validateSignature(parsedUrl)) {
      return c.json({ error: 'Invalid or expired URL signature' }, 403);
    }

    // Validate transformation parameters
    const validation = urlService.validateTransformations(parsedUrl.transformations);
    if (!validation.valid) {
      return c.json({ error: 'Invalid transformation parameters', details: validation.errors }, 400);
    }

    const imageService = createImageService(c.env);
    const cachingService = createCachingService(c.env);

    // Create cache key based on image ID and transformations
    const cacheKey = CacheKeys.transformedImage(imageId, parsedUrl.transformations);
    
    // Check cache first
    const cachedResult = await cachingService.get(cacheKey);
    if (cachedResult) {
      // Set CDN cache headers
      c.header('Cache-Control', 'public, max-age=31536000, stale-while-revalidate=86400');
      c.header('ETag', `"${imageId}-${JSON.stringify(parsedUrl.transformations)}"`);
      c.header('X-Cache', 'HIT');
      
      return c.json(cachedResult);
    }

    // Find the original image
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const media = await imageService.findById(imageId, user.id);
    if (!media) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Convert URL transformations to image processing parameters
    const transformParams = urlService.transformationsToParams(parsedUrl.transformations);

    // Process the image if transformations are requested
    let processedImageId = imageId;
    if (Object.keys(parsedUrl.transformations).length > 0) {
      const result = await imageService.processEditedImage({
        originalImageId: imageId,
        editingMetadata: transformParams,
        userId: user.id,
      });
      processedImageId = result.processedImageId;
    }

    // Generate the final image URL
    const finalMedia = await imageService.findById(processedImageId, user.id);
    if (!finalMedia) {
      return c.json({ error: 'Processed image not found' }, 500);
    }

    const imageUrl = await imageService.getImageUrl(finalMedia.storageKey, 'public', 31536000);

    const response = {
      url: imageUrl,
      imageId: processedImageId,
      transformations: parsedUrl.transformations,
      originalImageId: imageId,
      cacheControl: 'public, max-age=31536000, stale-while-revalidate=86400'
    };

    // Cache the response
    await cachingService.set(cacheKey, response, CacheTTL.LONG);

    // Set CDN cache headers
    c.header('Cache-Control', 'public, max-age=31536000, stale-while-revalidate=86400');
    c.header('ETag', `"${imageId}-${JSON.stringify(parsedUrl.transformations)}"`);
    c.header('X-Cache', 'MISS');

    return c.json(response);

  } catch (error) {
    console.error('Image transformation error:', error);
    return c.json({ error: 'Failed to process image transformation' }, 500);
  }
});

// Generate transformation URLs
imageTransformRouter.post('/generate-url', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { imageId, transformations } = body;

    if (!imageId) {
      return c.json({ error: 'Image ID is required' }, 400);
    }

    // Validate transformations
    const validation = urlService.validateTransformations(transformations || {});
    if (!validation.valid) {
      return c.json({ error: 'Invalid transformation parameters', details: validation.errors }, 400);
    }

    // Verify user has access to the image
    const imageService = createImageService(c.env);
    const media = await imageService.findById(imageId, user.id);
    if (!media) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Generate URL
    const url = urlService.generateUrl(imageId, transformations);

    return c.json({ url, imageId, transformations });

  } catch (error) {
    console.error('URL generation error:', error);
    return c.json({ error: 'Failed to generate URL' }, 500);
  }
});

// Generate preset URLs for an image
imageTransformRouter.get('/:id/presets', async (c) => {
  const imageId = c.req.param('id');
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    // Verify user has access to the image
    const imageService = createImageService(c.env);
    const media = await imageService.findById(imageId, user.id);
    if (!media) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Generate preset URLs
    const presets = urlService.generatePresetUrls(imageId);

    return c.json({ 
      imageId, 
      presets,
      baseUrl: '/images' 
    });

  } catch (error) {
    console.error('Preset generation error:', error);
    return c.json({ error: 'Failed to generate preset URLs' }, 500);
  }
});

// Parse and validate URL
imageTransformRouter.post('/parse-url', async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Parse URL
    const parsedUrl = urlService.parseUrl(url);
    if (!parsedUrl) {
      return c.json({ error: 'Invalid URL format' }, 400);
    }

    // Validate transformations
    const validation = urlService.validateTransformations(parsedUrl.transformations);
    
    // Validate signature
    const signatureValid = urlService.validateSignature(parsedUrl);

    return c.json({
      parsed: parsedUrl,
      validation: {
        transformations: validation,
        signature: signatureValid
      }
    });

  } catch (error) {
    console.error('URL parsing error:', error);
    return c.json({ error: 'Failed to parse URL' }, 500);
  }
});

// Batch generate URLs for multiple images
imageTransformRouter.post('/batch-generate', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { requests } = body;

    if (!requests || !Array.isArray(requests)) {
      return c.json({ error: 'Requests array is required' }, 400);
    }

    if (requests.length > 20) {
      return c.json({ error: 'Maximum 20 URLs per batch' }, 400);
    }

    const imageService = createImageService(c.env);
    const results = [];

    for (const request of requests) {
      const { imageId, transformations } = request;

      if (!imageId) {
        results.push({ error: 'Image ID is required', request });
        continue;
      }

      // Validate transformations
      const validation = urlService.validateTransformations(transformations || {});
      if (!validation.valid) {
        results.push({ 
          error: 'Invalid transformation parameters', 
          details: validation.errors,
          request 
        });
        continue;
      }

      // Verify user has access to the image
      const media = await imageService.findById(imageId, user.id);
      if (!media) {
        results.push({ error: 'Image not found', request });
        continue;
      }

      // Generate URL
      const url = urlService.generateUrl(imageId, transformations);
      results.push({ url, imageId, transformations });
    }

    return c.json({ results });

  } catch (error) {
    console.error('Batch URL generation error:', error);
    return c.json({ error: 'Failed to generate batch URLs' }, 500);
  }
});

// Get URL service configuration
imageTransformRouter.get('/config', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  return c.json({
    baseUrl: '/images',
    signUrls: true,
    urlTtl: 3600,
    supportedFormats: ['webp', 'jpeg', 'png', 'avif'],
    supportedFits: ['cover', 'contain', 'fill', 'inside', 'outside'],
    limits: {
      maxWidth: 4000,
      maxHeight: 4000,
      maxQuality: 100,
      maxBlur: 100,
      maxBrightness: 100,
      maxContrast: 100,
      maxSaturation: 100,
      maxRotation: 360
    }
  });
});

export default imageTransformRouter;