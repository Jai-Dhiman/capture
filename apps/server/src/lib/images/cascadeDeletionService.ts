import type { Bindings } from '../../types';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, inArray } from 'drizzle-orm';
import { media, post, draftPost } from '../../db/schema';
import { MetadataService } from './metadataService';
import { createCachingService, CacheKeys } from '../cache/cachingService';
import { nanoid } from 'nanoid';

export interface CascadeDeletionOptions {
  permanent?: boolean;
  softDelete?: boolean;
}

export interface CascadeDeletionResult {
  success: boolean;
  mediaId: string;
  deletedVariants: string[];
  storageDeleted: {
    mainImage: boolean;
    variants: string[];
  };
  errors: string[];
}

export interface CascadeDeletionPlan {
  mediaRecord: any;
  variants: any[];
  estimatedActions: number;
}

export class CascadeDeletionService {
  private db: ReturnType<typeof drizzle>;
  private r2: R2Bucket;
  private metadataService: MetadataService;
  private cachingService: any;

  constructor(env: Bindings) {
    this.db = drizzle(env.DB);
    this.r2 = env.IMAGE_STORAGE;
    this.metadataService = new MetadataService(env);
    this.cachingService = createCachingService(env);
  }

  /**
   * Plan a cascade deletion to understand what will be affected
   */
  async planCascadeDeletion(mediaId: string, userId: string): Promise<CascadeDeletionPlan> {
    // Get the media record
    const mediaRecord = await this.db
      .select()
      .from(media)
      .where(and(eq(media.id, mediaId), eq(media.userId, userId)))
      .limit(1);

    if (!mediaRecord[0]) {
      throw new Error('Media not found');
    }

    const record = mediaRecord[0];
    
    // Get metadata and variants
    const metadata = await this.metadataService.getMetadata(mediaId);
    const variants = metadata?.variants || [];

    return {
      mediaRecord: record,
      variants,
      estimatedActions: 1 + variants.length // main image + variants
    };
  }

  /**
   * Execute a simple cascade deletion - delete DB record, R2 files, and cache
   */
  async executeCascadeDeletion(
    mediaId: string, 
    userId: string, 
    options: CascadeDeletionOptions = {}
  ): Promise<CascadeDeletionResult> {
    const { permanent = true, softDelete = false } = options;

    const result: CascadeDeletionResult = {
      success: false,
      mediaId,
      deletedVariants: [],
      storageDeleted: { mainImage: false, variants: [] },
      errors: []
    };

    try {
      // Step 1: Get the media record and variants
      const plan = await this.planCascadeDeletion(mediaId, userId);
      console.log(`Starting deletion for media ${mediaId}`);

      // Step 2: Delete image variants from R2 storage
      for (const variant of plan.variants) {
        try {
          await this.r2.delete(variant.storageKey);
          result.deletedVariants.push(variant.id);
          result.storageDeleted.variants.push(variant.id);
        } catch (error) {
          result.errors.push(`Failed to delete variant ${variant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 3: Delete main image from R2 storage
      if (permanent) {
        try {
          await this.r2.delete(plan.mediaRecord.storageKey);
          result.storageDeleted.mainImage = true;
        } catch (error) {
          result.errors.push(`Failed to delete main image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 4: Delete metadata
      if (permanent && !softDelete) {
        try {
          await this.metadataService.deleteMetadata(mediaId);
        } catch (error) {
          result.errors.push(`Failed to delete metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 5: Delete database record
      if (permanent && !softDelete) {
        try {
          await this.db
            .delete(media)
            .where(eq(media.id, mediaId));
        } catch (error) {
          result.errors.push(`Failed to delete database record: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 6: Clear cache
      try {
        await this.cachingService.delete(CacheKeys.media(mediaId));
        await this.cachingService.invalidatePattern(`*${mediaId}*`);
        await this.cachingService.invalidatePattern(`*${plan.mediaRecord.storageKey}*`);
      } catch (error) {
        result.errors.push(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      result.success = result.errors.length === 0;
      console.log(`Deletion completed for media ${mediaId}: ${result.success ? 'success' : 'with errors'}`);

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error(`Deletion failed for media ${mediaId}:`, error);
    }

    return result;
  }

  /**
   * Execute batch cascade deletion with simple parallel processing
   */
  async executeBatchCascadeDeletion(
    mediaIds: string[],
    userId: string,
    options: CascadeDeletionOptions = {}
  ): Promise<{ results: CascadeDeletionResult[]; summary: { total: number; successful: number; failed: number } }> {
    console.log(`Starting batch deletion of ${mediaIds.length} media items`);

    // Process all deletions in parallel (simple approach for small beta)
    const deletionPromises = mediaIds.map(mediaId => 
      this.executeCascadeDeletion(mediaId, userId, options)
    );
    
    const results = await Promise.allSettled(deletionPromises);
    
    const finalResults: CascadeDeletionResult[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const mediaId = mediaIds[i];
      
      if (result.status === 'fulfilled') {
        finalResults.push(result.value);
        if (result.value.success) {
          successful++;
        } else {
          failed++;
        }
      } else {
        // Promise was rejected
        finalResults.push({
          success: false,
          mediaId,
          deletedVariants: [],
          storageDeleted: { mainImage: false, variants: [] },
          errors: [result.reason?.message || 'Unknown error']
        });
        failed++;
      }
    }

    console.log(`Batch deletion completed: ${successful} successful, ${failed} failed`);

    return {
      results: finalResults,
      summary: { total: mediaIds.length, successful, failed }
    };
  }

}

export function createCascadeDeletionService(env: Bindings): CascadeDeletionService {
  return new CascadeDeletionService(env);
}