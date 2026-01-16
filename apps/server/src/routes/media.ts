import type { Bindings, Variables } from '@/types';
import { Hono } from 'hono';
import { createImageService } from '../lib/images/imageService';
import { createCachingService, CacheKeys, CacheTTL } from '../lib/cache/cachingService';
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

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  const expirySeconds = Number.parseInt(c.req.query('expiry') || '1800');

  const maxExpirySeconds = 86400; // 24 hours
  const finalExpiry = Math.min(expirySeconds, maxExpirySeconds);

  try {
    const imageService = createImageService(c.env);
    // Use public access since media access control is handled by the GraphQL layer
    const media = await imageService.findByIdPublic(mediaId);

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

// Delete single media item
mediaRouter.delete('/:mediaId', async (c) => {
  const mediaId = c.req.param('mediaId');
  const user = c.get('user');
  const imageService = createImageService(c.env);
  
  // Parse query parameters
  const permanent = c.req.query('permanent') === 'true';
  const softDelete = c.req.query('soft') === 'true';

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const result = await imageService.delete(mediaId, user.id, 'user', { permanent, softDelete });
    return c.json(result);
  } catch (error) {
    console.error('Delete failed:', error);
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return c.json({ error: error.message }, 429);
    }
    if (error instanceof Error && error.message.includes('Access denied')) {
      return c.json({ error: error.message }, 403);
    }
    if (error instanceof Error && error.message.includes('Media not found')) {
      return c.json({ error: error.message }, 404);
    }
    return c.json({ error: 'Delete failed' }, 500);
  }
});

// Batch delete media items
mediaRouter.delete('/', async (c) => {
  const user = c.get('user');
  const imageService = createImageService(c.env);

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const { mediaIds, permanent = true, softDelete = false } = body;

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return c.json({ error: 'mediaIds array is required' }, 400);
    }

    if (mediaIds.length > 20) {
      return c.json({ error: 'Maximum 20 items per batch deletion' }, 400);
    }

    const result = await imageService.deleteBatch(mediaIds, user.id, 'user', { permanent, softDelete });
    return c.json(result);
  } catch (error) {
    console.error('Batch delete failed:', error);
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return c.json({ error: error.message }, 429);
    }
    if (error instanceof Error && error.message.includes('Access denied')) {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: 'Batch delete failed' }, 500);
  }
});

// CDN-optimized image serving endpoint with cache control headers
mediaRouter.get('/cdn/*', cdnSecurityHeaders(), async (c) => {
  const fullPath = c.req.path;
  const mediaId = fullPath.replace('/api/media/cdn/', ''); // Extract the media ID from the full path
  const variant = c.req.query('variant') || 'original';
  const format = c.req.query('format') || 'webp';

  try {
    // Validate that mediaId is not null or undefined
    if (!mediaId || typeof mediaId !== 'string') {
      console.error(`[CDN] Invalid mediaId: ${mediaId}`);
      return c.json({ error: 'Invalid media ID' }, 400);
    }

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

    // Check if this is a seed image path (profile images from seeding)
    if (mediaId.includes('seed-images/')) {
      // Handle seed images directly as storage keys
      const storageKey = mediaId; // seed-images/photo-27.jpg
      
      // Set aggressive CDN cache headers
      c.header('Cache-Control', 'public, max-age=31536000, stale-while-revalidate=86400'); // 1 year cache, 1 day stale
      c.header('ETag', `"${mediaId}-${variant}-${format}"`);
      c.header('Vary', 'Accept, Accept-Encoding');
      c.header('X-Cache', 'MISS');
      
      // Support conditional requests
      const ifNoneMatch = c.req.header('if-none-match');
      if (ifNoneMatch === `"${mediaId}-${variant}-${format}"`) {
        return c.newResponse(null, 304);
      }

      try {
        const url = await imageService.getImageUrl(storageKey, 'public', 604800); // 1 week expiry (max for R2)
        const response = { 
          url,
          variant,
          format,
          etag: `"${mediaId}-${variant}-${format}"`,
          cacheControl: 'public, max-age=31536000, stale-while-revalidate=86400'
        };
        
        // Cache the response for 1 hour
        await cachingService.set(cacheKey, response, CacheTTL.MEDIA);
        
        return c.json(response);
      } catch (error) {
        // Seed image doesn't exist - return null/empty response instead of error
        // This allows the client to handle the missing image gracefully
        console.warn(`[CDN] Seed image not found: ${storageKey}`, error);
        
        const fallbackResponse = { 
          url: null,
          variant,
          format,
          etag: `"${mediaId}-${variant}-${format}"`,
          cacheControl: 'public, max-age=31536000, stale-while-revalidate=86400',
          isMissing: true
        };
        
        // Cache the fallback response to avoid repeated lookups
        await cachingService.set(cacheKey, fallbackResponse, CacheTTL.MEDIA);
        
        return c.json(fallbackResponse);
      }
    }

    // Use public access since media access control is handled by the GraphQL layer
    const media = await imageService.findByIdPublic(mediaId);

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

    const url = await imageService.getImageUrl(media.storageKey, 'public', 604800); // 1 week expiry (max for R2)
    
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
    console.error(`[CDN] Error getting CDN image URL for ${mediaId}:`, error);
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

// Batch cache purging endpoint
mediaRouter.post('/purge-cache', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const { mediaIds } = body;

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return c.json({ error: 'mediaIds array is required' }, 400);
    }

    if (mediaIds.length > 20) {
      return c.json({ error: 'Maximum 20 items per batch purge' }, 400);
    }

    const imageService = createImageService(c.env);
    const cachingService = createCachingService(c.env);
    const results = [];
    const allPurgedUrls = [];

    for (const mediaId of mediaIds) {
      try {
        const media = await imageService.findById(mediaId, user.id);

        if (!media) {
          results.push({ mediaId, success: false, error: 'Media not found' });
          continue;
        }

        // Purge CDN cache for all variants and formats
        const cachePurgeResult = await imageService.purgeCDNCache(media.storageKey);
        
        // Also purge application cache
        await cachingService.delete(CacheKeys.media(mediaId));
        await cachingService.invalidatePattern(CacheKeys.cdnUrlPattern(mediaId));
        await cachingService.invalidatePattern(CacheKeys.mediaUrlPattern(media.storageKey));
        
        allPurgedUrls.push(...cachePurgeResult.urls);
        results.push({ mediaId, success: true, purgedUrls: cachePurgeResult.urls });
      } catch (error) {
        results.push({ 
          mediaId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    return c.json({ 
      results,
      summary: {
        total: mediaIds.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      },
      totalPurgedUrls: allPurgedUrls.length
    });
  } catch (error) {
    console.error('Error batch purging cache:', error);
    return c.json({ error: 'Failed to batch purge cache' }, 500);
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

// Transform image with WASM pipeline
mediaRouter.post('/transform/:mediaId', async (c) => {
  const mediaId = c.req.param('mediaId');
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const { transformParams } = body;

    if (!transformParams) {
      return c.json({ error: 'Transform parameters are required' }, 400);
    }

    const imageService = createImageService(c.env);
    
    // Process the image with transformation parameters
    const result = await imageService.processEditedImage({
      originalImageId: mediaId,
      editingMetadata: transformParams,
      userId: user.id,
    });

    return c.json({
      processedImageId: result.processedImageId,
      variants: result.variants,
      originalSize: result.originalSize,
      processedSize: result.processedSize,
    });
  } catch (error) {
    console.error('Image transformation failed:', error);
    return c.json({ error: 'Failed to transform image' }, 500);
  }
});

// Get deleted media items (for soft delete recovery)
// Feature not yet implemented - returns 501
mediaRouter.get('/deleted', async (c) => {
  return c.json({ error: 'Not Implemented', code: 'media/not-implemented' }, 501);
});

// Restore soft-deleted media
// Feature not yet implemented - returns 501
mediaRouter.post('/restore/:mediaId', async (c) => {
  return c.json({ error: 'Not Implemented', code: 'media/not-implemented' }, 501);
});

// Get WASM processor status
mediaRouter.get('/processor-status', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const imageService = createImageService(c.env);
    const status = imageService.getProcessorStatus();
    
    return c.json({ status });
  } catch (error) {
    console.error('Error getting processor status:', error);
    return c.json({ error: 'Failed to get status' }, 500);
  }
});

// Clear processor memory (admin endpoint)
mediaRouter.post('/clear-memory', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  // TODO: Add admin role check
  // if (user.role !== 'admin') {
  //   return c.json({ error: 'Admin access required' }, 403);
  // }

  try {
    const imageService = createImageService(c.env);
    imageService.clearProcessorMemory();
    
    return c.json({ success: true, message: 'Memory cleared' });
  } catch (error) {
    console.error('Error clearing memory:', error);
    return c.json({ error: 'Failed to clear memory' }, 500);
  }
});

// Batch transform multiple images
mediaRouter.post('/batch-transform', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const { transforms } = body;

    if (!transforms || !Array.isArray(transforms) || transforms.length === 0) {
      return c.json({ error: 'Transforms array is required' }, 400);
    }

    if (transforms.length > 5) {
      return c.json({ error: 'Maximum 5 transforms per batch' }, 400);
    }

    const imageService = createImageService(c.env);

    // Check if processor can handle more work
    if (!imageService.canProcessMore()) {
      return c.json({ error: 'Processor is at capacity, please try again later' }, 503);
    }

    // Process all transforms in parallel
    const results = await Promise.allSettled(
      transforms.map(async (transform: any) => {
        const { mediaId, transformParams } = transform;
        
        if (!mediaId || !transformParams) {
          throw new Error('mediaId and transformParams are required for each transform');
        }

        return imageService.processEditedImage({
          originalImageId: mediaId,
          editingMetadata: transformParams,
          userId: user.id,
        });
      })
    );

    // Separate successful and failed results
    const successful = results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value);
    
    const failed = results
      .filter(result => result.status === 'rejected')
      .map(result => (result as PromiseRejectedResult).reason.message || 'Unknown error');

    return c.json({
      successful,
      failed,
      total: transforms.length,
      successCount: successful.length,
      failureCount: failed.length,
    });

  } catch (error) {
    console.error('Batch transform failed:', error);
    return c.json({ error: 'Failed to process batch transforms' }, 500);
  }
});

// Get cleanup status and orphaned resources
// Feature not yet implemented - returns 501
mediaRouter.get('/cleanup-status', async (c) => {
  return c.json({ error: 'Not Implemented', code: 'media/not-implemented' }, 501);
});

// Trigger cleanup of orphaned resources
// Feature not yet implemented - returns 501
mediaRouter.post('/cleanup', async (c) => {
  return c.json({ error: 'Not Implemented', code: 'media/not-implemented' }, 501);
});

export default mediaRouter;
