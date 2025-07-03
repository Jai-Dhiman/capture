import { createD1Client } from '@/db';
import * as schema from '@/db/schema';
import type { Bindings } from '@/types';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { generateImageSignature, verifyImageSignature } from './crypto';

export interface ImageService {
  getUploadUrl: () => Promise<{ uploadURL: string; id: string }>;
  getBatchUploadUrls: (count: number) => Promise<Array<{ uploadURL: string; id: string }>>;
  getImageUrl: (imageId: string, variant?: string, expirySeconds?: number) => Promise<string>;
  getDirectCloudflareUrl: (
    cloudflareId: string,
    variant?: string,
    expirySeconds?: number,
  ) => Promise<string>;
  create: (data: {
    userId: string;
    imageId: string;
    [key: string]: any;
  }) => Promise<any>;
  createBatch: (
    mediaItems: Array<{
      userId: string;
      imageId: string;
      order: number;
      postId?: string;
      draftPostId?: string;
    }>,
  ) => Promise<any[]>;
  processEditedImage: (data: {
    originalImageId: string;
    editingMetadata: Record<string, unknown>;
    userId: string;
  }) => Promise<{ processedImageId: string }>;
  list: (userId: string) => Promise<any[]>;
  findById: (id: string, userId: string) => Promise<any>;
  delete: (id: string, userId: string) => Promise<void>;
  validateSignedUrl: (url: string) => Promise<boolean>;
}

export function createImageService(env: Bindings): ImageService {
  const db = createD1Client(env);
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_IMAGES_TOKEN;

  return {
    async getUploadUrl() {
      const imageId = nanoid();
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/direct_upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metadata: {},
            requireSignedURLs: true,
          }),
        },
      );

      const data = await response.json();

      interface CloudflareResponse {
        success: boolean;
        errors?: Array<any>;
      }

      const responseData = data as CloudflareResponse;
      if (!responseData.success) {
        console.error('Failed to get upload URL:', responseData.errors);
        throw new Error('Failed to get upload URL');
      }

      return {
        uploadURL: (data as { result: { uploadURL: string } }).result.uploadURL,
        id: imageId,
      };
    },

    async getBatchUploadUrls(count: number) {
      if (count > 10) {
        throw new Error('Maximum 10 images per batch');
      }

      const promises = Array.from({ length: count }, () => this.getUploadUrl());
      return await Promise.all(promises);
    },

    async getImageUrl(imageId, variant = 'public', expirySeconds = 1800) {
      const expiry = Math.floor(Date.now() / 1000) + expirySeconds; // Default 30 minutes
      const signature = await generateImageSignature(
        imageId,
        variant,
        expiry,
        env.CLOUDFLARE_IMAGES_KEY,
      );

      return `https://imagedelivery.net/${env.CLOUDFLARE_ACCOUNT_HASH}/${imageId}/${variant}?exp=${expiry}&sig=${signature}`;
    },

    async getDirectCloudflareUrl(cloudflareId: string, variant = 'public', expirySeconds = 1800) {
      const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
      const signature = await generateImageSignature(
        cloudflareId,
        variant,
        expiry,
        env.CLOUDFLARE_IMAGES_KEY,
      );

      return `https://imagedelivery.net/${env.CLOUDFLARE_ACCOUNT_HASH}/${cloudflareId}/${variant}?exp=${expiry}&sig=${signature}`;
    },

    async validateSignedUrl(url: string) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const segments = pathname.split('/').filter((segment) => segment.length > 0);

        if (segments.length < 3) return false;

        const imageId = segments[1];
        const variant = segments[2];
        const expiry = Number.parseInt(urlObj.searchParams.get('exp') || '0');
        const signature = urlObj.searchParams.get('sig') || '';

        return await verifyImageSignature(
          imageId,
          variant,
          expiry,
          signature,
          env.CLOUDFLARE_IMAGES_KEY,
        );
      } catch (error) {
        console.error('URL validation error:', error);
        return false;
      }
    },

    async create({ userId, imageId, ...data }) {
      if (!userId) throw new Error('User ID is required');
      if (!imageId) throw new Error('Image ID is required');

      try {
        const mediaId = nanoid();
        await db.insert(schema.media).values({
          id: mediaId,
          userId,
          type: 'image',
          storageKey: imageId,
          order: data.order || 0,
          postId: data.postId,
          draftPostId: data.draftPostId,
          createdAt: new Date().toISOString(),
        });

        const media = await db.query.media.findFirst({
          where: (media, { eq }) => eq(media.id, mediaId),
        });

        if (!media) throw new Error('Failed to create media record');
        return media;
      } catch (error) {
        console.error('Database error:', error);
        throw new Error(
          `Failed to create media record: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    },

    async createBatch(mediaItems) {
      if (mediaItems.length > 10) {
        throw new Error('Maximum 10 media items per batch');
      }

      try {
        const mediaRecords = mediaItems.map((item) => ({
          id: nanoid(),
          userId: item.userId,
          type: 'image',
          storageKey: item.imageId,
          order: item.order,
          postId: item.postId,
          draftPostId: item.draftPostId,
          createdAt: new Date().toISOString(),
        }));

        await db.insert(schema.media).values(mediaRecords);

        // Return the created records
        const createdMedia = await Promise.all(
          mediaRecords.map((record) =>
            db.query.media.findFirst({
              where: (media, { eq }) => eq(media.id, record.id),
            }),
          ),
        );

        return createdMedia.filter(Boolean);
      } catch (error) {
        console.error('Batch creation error:', error);
        throw new Error(
          `Failed to create media batch: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    },

    async processEditedImage({ originalImageId, editingMetadata, userId }) {
      try {
        // Note: For basic image editing (filters, cropping, etc.), Cloudflare Images
        // provides resizing and basic transformations via URL parameters.
        // For complex editing, you would:
        // 1. Download the original image
        // 2. Apply complex filters/adjustments using a processing library
        // 3. Upload the processed version to Cloudflare Images

        // For now, we'll return the original image ID since Cloudflare Images
        // handles most transformations via URL parameters
        const processedImageId = originalImageId;

        console.log('Image editing metadata stored for client-side processing:', {
          originalImageId,
          editingMetadata,
          userId,
        });

        return {
          processedImageId,
        };
      } catch (error) {
        console.error('Image processing error:', error);
        throw new Error('Failed to process edited image');
      }
    },

    async list(userId) {
      return await db.query.media.findMany({
        where: (media, { eq }) => eq(media.userId, userId),
      });
    },

    async findById(id, userId) {
      return await db.query.media.findFirst({
        where: (media, { and }) => and(eq(media.id, id), eq(media.userId, userId)),
      });
    },

    async delete(id, userId) {
      const media = await this.findById(id, userId);
      if (!media) return;

      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${media.storageKey}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );

      await db
        .delete(schema.media)
        .where(and(eq(schema.media.id, id), eq(schema.media.userId, userId)));
    },
  };
}
