import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import {
  R2ImageService,
  type ImageUploadOptions,
  type TransformationParams,
} from '../lib/images/r2ImageService';
import type { Bindings } from '../types';

const app = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const uploadSchema = z.object({
  maxWidth: z.number().max(4096).optional(),
  maxHeight: z.number().max(4096).optional(),
  quality: z.number().min(1).max(100).optional(),
  format: z.enum(['webp', 'avif', 'jpeg', 'png']).optional(),
  generateThumbnails: z.boolean().default(true),
  blurHash: z.boolean().default(true),
});

const transformSchema = z.object({
  w: z.number().max(4096).optional(),
  h: z.number().max(4096).optional(),
  f: z.enum(['webp', 'avif', 'jpeg', 'png']).optional(),
  q: z.number().min(1).max(100).optional(),
  fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).default('cover'),
  pos: z.enum(['center', 'top', 'bottom', 'left', 'right']).default('center'),
});

/**
 * Upload a single image
 */
app.post('/upload', async (c) => {
  try {
    const imageService = new R2ImageService(c.env);

    // Parse form data
    const formData = await c.req.formData();
    const file = formData.get('image') as File;
    const optionsJson = formData.get('options') as string;

    if (!file) {
      return c.json({ error: 'No image file provided' }, 400);
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'File must be an image' }, 400);
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'File too large (max 10MB)' }, 400);
    }

    // Parse options
    let options: ImageUploadOptions = {};
    if (optionsJson) {
      try {
        const parsedOptions = JSON.parse(optionsJson);
        const validated = uploadSchema.parse(parsedOptions);
        options = validated;
      } catch (error) {
        return c.json({ error: 'Invalid options format' }, 400);
      }
    }

    // Upload image
    const metadata = await imageService.uploadImage(file, file.name, options);

    return c.json({
      success: true,
      data: metadata,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return c.json({ error: 'Failed to upload image' }, 500);
  }
});

/**
 * Batch upload images
 */
app.post('/batch-upload', async (c) => {
  try {
    const imageService = new R2ImageService(c.env);

    const formData = await c.req.formData();
    const files: Array<{ file: File; filename: string }> = [];
    const optionsJson = formData.get('options') as string;

    // Collect all image files
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('images[') && value instanceof File) {
        if (!value.type.startsWith('image/')) {
          return c.json({ error: `File ${value.name} is not an image` }, 400);
        }
        files.push({ file: value, filename: value.name });
      }
    }

    if (files.length === 0) {
      return c.json({ error: 'No image files provided' }, 400);
    }

    if (files.length > 10) {
      return c.json({ error: 'Maximum 10 files per batch' }, 400);
    }

    // Parse options
    let options: ImageUploadOptions = {};
    if (optionsJson) {
      try {
        const parsedOptions = JSON.parse(optionsJson);
        const validated = uploadSchema.parse(parsedOptions);
        options = validated;
      } catch (error) {
        return c.json({ error: 'Invalid options format' }, 400);
      }
    }

    // Upload all images
    const metadata = await imageService.batchUpload(files, options);

    return c.json({
      success: true,
      data: metadata,
      count: metadata.length,
    });
  } catch (error) {
    console.error('Batch upload error:', error);
    return c.json({ error: 'Failed to upload images' }, 500);
  }
});

/**
 * Get image with transformations
 */
app.get('/:imageId', zValidator('query', transformSchema), async (c) => {
  try {
    const imageService = new R2ImageService(c.env);
    const imageId = c.req.param('imageId');
    const params = c.req.valid('query');

    // Convert query params to transformation params
    const transformParams: TransformationParams = {
      width: params.w,
      height: params.h,
      format: params.f,
      quality: params.q,
      fit: params.fit,
      position: params.pos,
    };

    const result = await imageService.getImage(imageId, transformParams);

    if (!result) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Set appropriate headers
    c.header('Content-Type', result.contentType);
    c.header('Cache-Control', 'public, max-age=31536000'); // 1 year
    c.header('ETag', result.cacheKey);

    // Check if client has cached version
    const ifNoneMatch = c.req.header('If-None-Match');
    if (ifNoneMatch === result.cacheKey) {
      return c.text('', 304);
    }

    return c.body(result.data);
  } catch (error) {
    console.error('Image get error:', error);
    return c.json({ error: 'Failed to get image' }, 500);
  }
});

/**
 * Get image metadata
 */
app.get('/:imageId/metadata', async (c) => {
  try {
    const imageService = new R2ImageService(c.env);
    const imageId = c.req.param('imageId');

    const metadata = await imageService.getImageMetadata(imageId);

    if (!metadata) {
      return c.json({ error: 'Image not found' }, 404);
    }

    return c.json({
      success: true,
      data: metadata,
    });
  } catch (error) {
    console.error('Metadata get error:', error);
    return c.json({ error: 'Failed to get metadata' }, 500);
  }
});

/**
 * Get responsive image URLs
 */
app.get('/:imageId/responsive', async (c) => {
  try {
    const imageService = new R2ImageService(c.env);
    const imageId = c.req.param('imageId');

    const sizesParam = c.req.query('sizes') || '300,600,1200';
    const sizes = sizesParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((s) => !isNaN(s));

    const metadata = await imageService.getImageMetadata(imageId);
    if (!metadata) {
      return c.json({ error: 'Image not found' }, 404);
    }

    const responsiveUrls = imageService.getResponsiveUrls(imageId, sizes);

    return c.json({
      success: true,
      data: {
        original: {
          width: metadata.width,
          height: metadata.height,
          url: imageService.getImageUrl(imageId),
        },
        responsive: responsiveUrls,
        blurHash: metadata.blurHash,
      },
    });
  } catch (error) {
    console.error('Responsive URLs error:', error);
    return c.json({ error: 'Failed to generate responsive URLs' }, 500);
  }
});

/**
 * Delete an image
 */
app.delete('/:imageId', async (c) => {
  try {
    const imageService = new R2ImageService(c.env);
    const imageId = c.req.param('imageId');

    const success = await imageService.deleteImage(imageId);

    if (!success) {
      return c.json({ error: 'Failed to delete image' }, 500);
    }

    return c.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Image delete error:', error);
    return c.json({ error: 'Failed to delete image' }, 500);
  }
});

/**
 * Get storage statistics
 */
app.get('/stats/storage', async (c) => {
  try {
    const imageService = new R2ImageService(c.env);
    const stats = await imageService.getStorageStats();

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Storage stats error:', error);
    return c.json({ error: 'Failed to get storage stats' }, 500);
  }
});

/**
 * Health check endpoint
 */
app.get('/health', async (c) => {
  try {
    // Basic health check - try to list objects
    const r2 = c.env.IMAGES_BUCKET;
    await r2.list({ limit: 1 });

    return c.json({
      success: true,
      service: 'R2 Image Service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return c.json(
      {
        success: false,
        service: 'R2 Image Service',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      500,
    );
  }
});

export default app;
