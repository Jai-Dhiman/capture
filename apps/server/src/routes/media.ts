import { createD1Client } from '@/db';
import * as schema from '@/db/schema';
import type { Bindings, Variables } from '@/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createImageService } from '../lib/images/imageService';
import { createCachingService, CacheKeys, CacheTTL } from '../lib/cache/cachingService';

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

    // Generate URL for immediate use
    const baseUrl = new URL(c.req.url).origin;
    const url = imageService.getImageUrl(media.storageKey, baseUrl);

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
    const baseUrl = new URL(c.req.url).origin;
    const mediaWithUrls = createdMedia.map((media) => {
      const url = imageService.getImageUrl(media.storageKey, baseUrl);
      return { ...media, url };
    });

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

    const baseUrl = new URL(c.req.url).origin;
    const url = imageService.getImageUrl(media.storageKey, baseUrl);
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
  const permanent = c.req.query('permanent') === 'true';

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    if (permanent) {
      // Permanent delete via imageService (R2 + DB)
      const imageService = createImageService(c.env);
      const result = await imageService.delete(mediaId, user.id, 'user', { permanent: true, softDelete: false });
      return c.json(result);
    }

    // Default: soft-delete by setting deletedAt
    const db = createD1Client(c.env);

    const media = await db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, mediaId))
      .get();

    if (!media) {
      return c.json({ error: 'Media not found' }, 404);
    }

    if (media.userId !== user.id) {
      return c.json({ error: 'Access denied' }, 403);
    }

    await db
      .update(schema.media)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(schema.media.id, mediaId));

    return c.json({ success: true, message: 'Media soft-deleted', mediaId });
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

// Legacy CDN path - redirect to new /cdn/* path
mediaRouter.get('/cdn/*', async (c) => {
  const fullPath = c.req.path;
  const mediaId = fullPath.replace('/api/media/cdn/', '');
  const url = new URL(c.req.url);
  url.pathname = `/cdn/${mediaId}`;
  return c.redirect(url.toString(), 301);
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

  try {
    const imageService = createImageService(c.env);
    const baseUrl = new URL(c.req.url).origin;
    const url = imageService.getDirectCloudflareUrl(cloudflareId, baseUrl);
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
mediaRouter.get('/deleted', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const db = createD1Client(c.env);
    const limit = Number(c.req.query('limit') || '50');
    const offset = Number(c.req.query('offset') || '0');

    const deletedMedia = await db
      .select()
      .from(schema.media)
      .where(
        and(
          eq(schema.media.userId, user.id),
          sql`${schema.media.deletedAt} IS NOT NULL`,
        ),
      )
      .orderBy(desc(schema.media.deletedAt))
      .limit(limit)
      .offset(offset)
      .all();

    return c.json({
      media: deletedMedia,
      count: deletedMedia.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching deleted media:', error);
    return c.json({ error: 'Failed to fetch deleted media' }, 500);
  }
});

// Restore soft-deleted media
mediaRouter.post('/restore/:mediaId', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const mediaId = c.req.param('mediaId');
    const db = createD1Client(c.env);

    const media = await db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, mediaId))
      .get();

    if (!media) {
      return c.json({ error: 'Media not found' }, 404);
    }

    if (media.userId !== user.id) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    if (!media.deletedAt) {
      return c.json({ error: 'Media is not deleted' }, 400);
    }

    await db
      .update(schema.media)
      .set({ deletedAt: null })
      .where(eq(schema.media.id, mediaId));

    return c.json({ success: true, message: 'Media restored', mediaId });
  } catch (error) {
    console.error('Error restoring media:', error);
    return c.json({ error: 'Failed to restore media' }, 500);
  }
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
mediaRouter.get('/cleanup-status', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const db = createD1Client(c.env);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const pendingCleanup = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.media)
      .where(
        and(
          sql`${schema.media.deletedAt} IS NOT NULL`,
          sql`${schema.media.deletedAt} < ${thirtyDaysAgo}`,
        ),
      )
      .get();

    const totalDeleted = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.media)
      .where(sql`${schema.media.deletedAt} IS NOT NULL`)
      .get();

    return c.json({
      pendingPermanentDeletion: pendingCleanup?.count ?? 0,
      totalSoftDeleted: totalDeleted?.count ?? 0,
      retentionDays: 30,
      cutoffDate: thirtyDaysAgo,
    });
  } catch (error) {
    console.error('Error fetching cleanup status:', error);
    return c.json({ error: 'Failed to get cleanup status' }, 500);
  }
});

// Trigger cleanup of orphaned resources
mediaRouter.post('/cleanup', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const db = createD1Client(c.env);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const expiredMedia = await db
      .select()
      .from(schema.media)
      .where(
        and(
          sql`${schema.media.deletedAt} IS NOT NULL`,
          sql`${schema.media.deletedAt} < ${thirtyDaysAgo}`,
        ),
      )
      .all();

    let deletedCount = 0;
    const errors: string[] = [];

    for (const media of expiredMedia) {
      try {
        await c.env.IMAGE_STORAGE.delete(media.storageKey);
        await db.delete(schema.media).where(eq(schema.media.id, media.id));
        deletedCount++;
      } catch (error) {
        const msg = `Failed to delete media ${media.id}: ${error instanceof Error ? error.message : 'Unknown'}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    return c.json({
      success: true,
      processed: expiredMedia.length,
      deleted: deletedCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error during media cleanup:', error);
    return c.json({ error: 'Failed to perform cleanup' }, 500);
  }
});

export default mediaRouter;
