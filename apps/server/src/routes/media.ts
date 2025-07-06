import type { Bindings, Variables } from '@/types';
import { Hono } from 'hono';
import { createImageService } from '../lib/images/imageService';
import { createCachingService, CacheKeys, CacheTTL } from '../lib/cache/cachingService';
import { cors } from 'hono/cors';
import { cdnSecurityHeaders } from '../middleware/security';

const mediaRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Get upload URL for direct image upload
mediaRouter.post('/image-upload', async (c) => {
  const imageService = createImageService(c.env);
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const { contentType, fileSize } = body;
    
    const { uploadURL, id } = await imageService.getUploadUrl(
      user.id,
      'user', // Default role, could be retrieved from user context
      contentType,
      fileSize
    );
    return c.json({ uploadURL, id });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return c.json({ error: error.message }, 429);
    }
    if (error instanceof Error && error.message.includes('Access denied')) {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: 'Failed to generate upload URL' }, 500);
  }
});

// Get batch upload URLs for multiple images
mediaRouter.post('/batch-upload', async (c) => {
  const imageService = createImageService(c.env);
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const { count, contentType } = body;

    if (!count || count < 1 || count > 10) {
      return c.json({ error: 'Count must be between 1 and 10' }, 400);
    }

    const uploadUrls = await imageService.getBatchUploadUrls(user.id, 'user', count, contentType);
    return c.json({ uploads: uploadUrls });
  } catch (error) {
    console.error('Error generating batch upload URLs:', error);
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return c.json({ error: error.message }, 429);
    }
    if (error instanceof Error && error.message.includes('Access denied')) {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: 'Failed to generate batch upload URLs' }, 500);
  }
});

// Create media record after successful upload
mediaRouter.post('/image-record', async (c) => {
  const imageService = createImageService(c.env);
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const { imageId, order, postId, draftPostId } = body;

    if (!imageId) {
      return c.json({ error: 'Image ID is required' }, 400);
    }

    const media = await imageService.create({
      userId: user.id,
      imageId,
      order: order || 0,
      postId,
      draftPostId,
    });

    // Generate URL with short expiry for immediate use
    const url = await imageService.getImageUrl(media.storageKey, 'public', 300); // 5 minute expiry

    return c.json({
      media: {
        ...media,
        url,
      },
    });
  } catch (error) {
    console.error('Failed to create media record:', error);
    return c.json({ error: 'Failed to create media record' }, 500);
  }
});

// Create batch media records after successful uploads
mediaRouter.post('/batch-records', async (c) => {
  const imageService = createImageService(c.env);
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const { mediaItems } = body;

    if (!mediaItems || !Array.isArray(mediaItems) || mediaItems.length === 0) {
      return c.json({ error: 'Media items array is required' }, 400);
    }

    if (mediaItems.length > 10) {
      return c.json({ error: 'Maximum 10 media items per batch' }, 400);
    }

    // Validate all items have required fields
    for (const item of mediaItems) {
      if (!item.imageId) {
        return c.json({ error: 'All items must have imageId' }, 400);
      }
    }

    // Add userId to all items
    const enrichedItems = mediaItems.map((item, index) => ({
      ...item,
      userId: user.id,
      order: item.order ?? index,
    }));

    const createdMedia = await imageService.createBatch(enrichedItems);

    // Generate URLs for immediate use
    const mediaWithUrls = await Promise.all(
      createdMedia.map(async (media) => {
        const url = await imageService.getImageUrl(media.storageKey, 'public', 300);
        return { ...media, url };
      }),
    );

    return c.json({ media: mediaWithUrls });
  } catch (error) {
    console.error('Failed to create batch media records:', error);
    return c.json({ error: 'Failed to create batch media records' }, 500);
  }
});

// Process edited image with filters and adjustments
mediaRouter.post('/process-edited', async (c) => {
  const imageService = createImageService(c.env);
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const { originalImageId, editingMetadata } = body;

    if (!originalImageId || !editingMetadata) {
      return c.json({ error: 'Original image ID and editing metadata are required' }, 400);
    }

    const result = await imageService.processEditedImage({
      originalImageId,
      editingMetadata,
      userId: user.id,
    });

    // Optimize the processed image for different variants
    await imageService.optimizeForVariants(result.processedImageId, result.variants);

    return c.json({
      processedImageId: result.processedImageId,
      variants: result.variants,
      originalImageId,
    });
  } catch (error) {
    console.error('Failed to process edited image:', error);
    return c.json({ error: 'Failed to process edited image' }, 500);
  }
});

// Get image URL with CDN optimization
mediaRouter.get('/:mediaId/url', async (c) => {
  const mediaId = c.req.param('mediaId');
  const user = c.get('user');

  const expirySeconds = Number.parseInt(c.req.query('expiry') || '1800');

  const maxExpirySeconds = 86400; // 24 hours
  const finalExpiry = Math.min(expirySeconds, maxExpirySeconds);

  try {
    const imageService = createImageService(c.env);
    const media = await imageService.findById(mediaId, user.id);

    if (!media) {
      return c.json({ error: 'Media not found' }, 404);
    }

    // Add CDN-friendly cache headers for URL responses
    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60'); // 5 min cache, 1 min stale
    c.header('ETag', `"url-${media.id}"`);
    
    const ifNoneMatch = c.req.header('if-none-match');
    if (ifNoneMatch === `"url-${media.id}"`) {
      return c.newResponse(null, 304);
    }

    const url = await imageService.getImageUrl(media.storageKey, 'public', finalExpiry);
    return c.json({ url });
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    return c.json({ error: 'Failed to get image URL' }, 500);
  }
});

// Delete media
mediaRouter.delete('/:mediaId', async (c) => {
  const mediaId = c.req.param('mediaId');
  const user = c.get('user');
  const imageService = createImageService(c.env);

  try {
    await imageService.delete(mediaId, user.id, 'user');
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete failed:', error);
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return c.json({ error: error.message }, 429);
    }
    if (error instanceof Error && error.message.includes('Access denied')) {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: 'Delete failed' }, 500);
  }
});

// CDN-optimized image serving endpoint with cache control headers
mediaRouter.get('/cdn/:mediaId', cdnSecurityHeaders(), async (c) => {
  const mediaId = c.req.param('mediaId');
  const user = c.get('user');
  const variant = c.req.query('variant') || 'original';
  const format = c.req.query('format') || 'webp';

  try {
    const imageService = createImageService(c.env);
    const cachingService = createCachingService(c.env);
    
    // Check cache first for the CDN URL response
    const cacheKey = CacheKeys.cdnUrl(mediaId, variant, format);
    const cachedResponse = await cachingService.get(cacheKey);
    
    if (cachedResponse) {
      // Set CDN headers for cached response
      c.header('Cache-Control', 'public, max-age=31536000, stale-while-revalidate=86400');
      c.header('ETag', `"${mediaId}-${variant}-${format}"`);
      c.header('Vary', 'Accept, Accept-Encoding');
      c.header('X-Cache', 'HIT');
      
      return c.json(cachedResponse);
    }

    const media = await imageService.findById(mediaId, user.id);

    if (!media) {
      return c.json({ error: 'Media not found' }, 404);
    }

    // Set aggressive CDN cache headers
    c.header('Cache-Control', 'public, max-age=31536000, stale-while-revalidate=86400'); // 1 year cache, 1 day stale
    c.header('ETag', `"${media.id}-${variant}-${format}"`);
    c.header('Vary', 'Accept, Accept-Encoding');
    c.header('X-Cache', 'MISS');
    
    // Support conditional requests
    const ifNoneMatch = c.req.header('if-none-match');
    if (ifNoneMatch === `"${media.id}-${variant}-${format}"`) {
      return c.newResponse(null, 304);
    }

    const url = await imageService.getImageUrl(media.storageKey, 'public', 31536000); // 1 year expiry
    
    const response = { 
      url,
      variant,
      format,
      etag: `"${media.id}-${variant}-${format}"`,
      cacheControl: 'public, max-age=31536000, stale-while-revalidate=86400'
    };
    
    // Cache the response for 1 hour
    await cachingService.set(cacheKey, response, CacheTTL.MEDIA);
    
    return c.json(response);
  } catch (error) {
    console.error('Error getting CDN image URL:', error);
    return c.json({ error: 'Failed to get image URL' }, 500);
  }
});

// Cache purging endpoint for CDN invalidation
mediaRouter.post('/purge-cache/:mediaId', async (c) => {
  const mediaId = c.req.param('mediaId');
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const imageService = createImageService(c.env);
    const cachingService = createCachingService(c.env);
    const media = await imageService.findById(mediaId, user.id);

    if (!media) {
      return c.json({ error: 'Media not found' }, 404);
    }

    // Purge CDN cache for all variants and formats
    const cachePurgeResult = await imageService.purgeCDNCache(media.storageKey);
    
    // Also purge application cache
    await cachingService.delete(CacheKeys.media(mediaId));
    await cachingService.invalidatePattern(CacheKeys.cdnUrlPattern(mediaId));
    await cachingService.invalidatePattern(CacheKeys.mediaUrlPattern(media.storageKey));
    
    return c.json({ 
      success: true, 
      mediaId,
      purgedUrls: cachePurgeResult.urls,
      purgedCacheKeys: ['media', 'cdn_urls', 'media_urls']
    });
  } catch (error) {
    console.error('Error purging cache:', error);
    return c.json({ error: 'Failed to purge cache' }, 500);
  }
});

mediaRouter.get('/cloudflare-url/:cloudflareId', async (c) => {
  const cloudflareId = c.req.param('cloudflareId');
  const expirySeconds = Number.parseInt(c.req.query('expiry') || '1800');
  const maxExpirySeconds = 86400;
  const finalExpiry = Math.min(expirySeconds, maxExpirySeconds);

  try {
    const imageService = createImageService(c.env);
    const url = await imageService.getDirectCloudflareUrl(cloudflareId, 'public', finalExpiry);
    return c.json({ url });
  } catch (error) {
    console.error('Error getting Cloudflare URL:', error);
    return c.json({ error: 'Failed to get image URL' }, 500);
  }
});

export default mediaRouter;
