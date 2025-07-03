import type { Bindings, Variables } from '@/types';
import { Hono } from 'hono';
import { createImageService } from '../lib/imageService';

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
    const { uploadURL, id } = await imageService.getUploadUrl();
    return c.json({ uploadURL, id });
  } catch (error) {
    console.error('Error generating upload URL:', error);
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
    const { count } = body;

    if (!count || count < 1 || count > 10) {
      return c.json({ error: 'Count must be between 1 and 10' }, 400);
    }

    const uploadUrls = await imageService.getBatchUploadUrls(count);
    return c.json({ uploads: uploadUrls });
  } catch (error) {
    console.error('Error generating batch upload URLs:', error);
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
      })
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

// Get image URL
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
    await imageService.delete(mediaId, user.id);
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete failed:', error);
    return c.json({ error: 'Delete failed' }, 500);
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
