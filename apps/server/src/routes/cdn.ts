import { createImageService } from '@/lib/images/imageService';
import { createCachingService, CacheKeys, CacheTTL } from '@/lib/cache/cachingService';
import type { Bindings } from '@/types';
import { Hono } from 'hono';

const cdnRouter = new Hono<{ Bindings: Bindings }>();

cdnRouter.get('/*', async (c) => {
  const fullPath = c.req.path;
  const mediaId = fullPath.replace('/cdn/', '');
  const variant = c.req.query('variant') || 'original';
  const format = c.req.query('format') || 'webp';

  try {
    if (!mediaId || typeof mediaId !== 'string') {
      return c.json({ error: 'Invalid media ID' }, 400);
    }

    const imageService = createImageService(c.env);
    const cachingService = createCachingService(c.env);

    const cacheKey = CacheKeys.cdnUrl(mediaId, variant, format);

    const cachedResponse = await cachingService.get(cacheKey);
    if (cachedResponse) {
      c.header('Cache-Control', 'public, max-age=31536000, stale-while-revalidate=86400');
      c.header('ETag', `"${mediaId}-${variant}-${format}"`);
      c.header('Vary', 'Accept, Accept-Encoding');
      c.header('X-Cache', 'HIT');
      c.header('Access-Control-Allow-Origin', '*');
      return c.json(cachedResponse);
    }

    if (mediaId.includes('seed-images/')) {
      const storageKey = mediaId;
      c.header('Cache-Control', 'public, max-age=31536000, stale-while-revalidate=86400');
      c.header('ETag', `"${mediaId}-${variant}-${format}"`);
      c.header('Vary', 'Accept, Accept-Encoding');
      c.header('X-Cache', 'MISS');
      c.header('Access-Control-Allow-Origin', '*');

      const ifNoneMatch = c.req.header('if-none-match');
      if (ifNoneMatch === `"${mediaId}-${variant}-${format}"`) {
        return c.newResponse(null, 304);
      }

      const baseUrl = new URL(c.req.url).origin;
      const url = imageService.getImageUrl(storageKey, baseUrl);
      const response = {
        url,
        variant,
        format,
        etag: `"${mediaId}-${variant}-${format}"`,
        cacheControl: 'public, max-age=31536000, stale-while-revalidate=86400',
      };

      await cachingService.set(cacheKey, response, CacheTTL.MEDIA);
      return c.json(response);
    }

    const media = await imageService.findByIdPublic(mediaId);
    if (!media) {
      return c.json({ error: 'Media not found' }, 404);
    }

    c.header('Cache-Control', 'public, max-age=31536000, stale-while-revalidate=86400');
    c.header('ETag', `"${media.id}-${variant}-${format}"`);
    c.header('Vary', 'Accept, Accept-Encoding');
    c.header('X-Cache', 'MISS');
    c.header('Access-Control-Allow-Origin', '*');

    const ifNoneMatch = c.req.header('if-none-match');
    if (ifNoneMatch === `"${media.id}-${variant}-${format}"`) {
      return c.newResponse(null, 304);
    }

    const baseUrl = new URL(c.req.url).origin;
    const url = imageService.getImageUrl(media.storageKey, baseUrl);
    const response = {
      url,
      variant,
      format,
      etag: `"${media.id}-${variant}-${format}"`,
      cacheControl: 'public, max-age=31536000, stale-while-revalidate=86400',
    };

    await cachingService.set(cacheKey, response, CacheTTL.MEDIA);
    return c.json(response);
  } catch (error) {
    console.error(`[CDN] Error getting CDN image URL for ${mediaId}:`, error);
    return c.json({ error: 'Failed to get image URL' }, 500);
  }
});

export default cdnRouter;
