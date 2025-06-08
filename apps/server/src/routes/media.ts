import { Hono } from 'hono';
import { createImageService } from '../lib/imageService';
import type { Bindings, Variables } from '@/types';

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

// Create media record after successful upload
mediaRouter.post('/image-record', async (c) => {
  const imageService = createImageService(c.env);
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const { imageId, order, postId } = body;

    if (!imageId) {
      return c.json({ error: 'Image ID is required' }, 400);
    }

    const media = await imageService.create({
      userId: user.id,
      imageId,
      order: order || 0,
      postId,
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
