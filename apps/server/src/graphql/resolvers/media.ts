import { createImageService } from '../../lib/images/imageService';
import type { ContextType } from '../../types';

export const mediaResolvers = {
  Mutation: {
    async uploadMedia(
      _parent: unknown,
      { input }: { input: { count?: number } },
      context: ContextType,
    ) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      try {
        const imageService = createImageService(context.env);
        const count = input.count || 1;

        if (count < 1 || count > 10) {
          throw new Error('Count must be between 1 and 10');
        }

        if (count === 1) {
          const upload = await imageService.getUploadUrl(context.user.id);
          return { uploads: [upload] };
        }

        const uploads = await imageService.getBatchUploadUrls(context.user.id, 'user', count);
        return { uploads };
      } catch (error) {
        console.error('Upload URL generation error:', error);
        throw new Error(
          `Failed to generate upload URLs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async uploadMediaBatch(
      _parent: unknown,
      { input }: { input: { mediaItems: any[] } },
      context: ContextType,
    ) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      try {
        const imageService = createImageService(context.env);
        const { mediaItems } = input;

        if (!mediaItems || !Array.isArray(mediaItems) || mediaItems.length === 0) {
          throw new Error('Media items array is required');
        }

        if (mediaItems.length > 10) {
          throw new Error('Maximum 10 media items per batch');
        }

        // Validate all items have required fields
        for (const item of mediaItems) {
          if (!item.imageId) {
            throw new Error('All items must have imageId');
          }
        }

        // Add userId to all items
        const enrichedItems = mediaItems.map((item, index) => ({
          ...item,
          userId: context.user.id,
          order: item.order ?? index,
        }));

        const createdMedia = await imageService.createBatch(enrichedItems);
        return { media: createdMedia };
      } catch (error) {
        console.error('Batch media creation error:', error);
        throw new Error(
          `Failed to create batch media: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async processEditedImage(
      _parent: unknown,
      { input }: { input: { originalImageId: string; editingMetadata: any } },
      context: ContextType,
    ) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      try {
        const imageService = createImageService(context.env);
        const { originalImageId, editingMetadata } = input;

        if (!originalImageId || !editingMetadata) {
          throw new Error('Original image ID and editing metadata are required');
        }

        const result = await imageService.processEditedImage({
          originalImageId,
          editingMetadata,
          userId: context.user.id,
        });

        // Optimize the processed image for different variants
        await imageService.optimizeForVariants(result.processedImageId, result.variants);

        return {
          processedImageId: result.processedImageId,
          variants: result.variants,
          originalImageId,
        };
      } catch (error) {
        console.error('Image processing error:', error);
        throw new Error(
          `Failed to process edited image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },
};
