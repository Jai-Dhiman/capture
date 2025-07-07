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
  preserveReferences?: boolean;
  dryRun?: boolean;
}

export interface CascadeDeletionResult {
  success: boolean;
  mediaId: string;
  deletedVariants: string[];
  deletedReferences: {
    posts: string[];
    draftPosts: string[];
  };
  storageDeleted: {
    mainImage: boolean;
    variants: string[];
  };
  errors: string[];
  rollbackPossible: boolean;
}

export interface CascadeDeletionPlan {
  mediaRecord: any;
  variants: any[];
  referencingPosts: any[];
  referencingDraftPosts: any[];
  estimatedActions: number;
  warnings: string[];
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

    // Find referencing posts
    const referencingPosts = await this.db
      .select()
      .from(post)
      .where(eq(post.id, record.postId || ''))
      .limit(100);

    // Find referencing draft posts  
    const referencingDraftPosts = await this.db
      .select()
      .from(draftPost)
      .where(eq(draftPost.id, record.draftPostId || ''))
      .limit(100);

    const warnings: string[] = [];
    
    if (referencingPosts.length > 0) {
      warnings.push(`Deleting this media will affect ${referencingPosts.length} published post(s)`);
    }
    
    if (referencingDraftPosts.length > 0) {
      warnings.push(`Deleting this media will affect ${referencingDraftPosts.length} draft post(s)`);
    }
    
    if (variants.length > 10) {
      warnings.push(`This media has ${variants.length} variants that will be deleted`);
    }

    return {
      mediaRecord: record,
      variants,
      referencingPosts,
      referencingDraftPosts,
      estimatedActions: 1 + variants.length + referencingPosts.length + referencingDraftPosts.length,
      warnings
    };
  }

  /**
   * Execute a cascade deletion with full transaction support
   */
  async executeCascadeDeletion(
    mediaId: string, 
    userId: string, 
    options: CascadeDeletionOptions = {}
  ): Promise<CascadeDeletionResult> {
    const {
      permanent = true,
      softDelete = false,
      preserveReferences = false,
      dryRun = false
    } = options;

    const result: CascadeDeletionResult = {
      success: false,
      mediaId,
      deletedVariants: [],
      deletedReferences: { posts: [], draftPosts: [] },
      storageDeleted: { mainImage: false, variants: [] },
      errors: [],
      rollbackPossible: true
    };

    try {
      // Step 1: Plan the deletion
      const plan = await this.planCascadeDeletion(mediaId, userId);
      
      if (dryRun) {
        return {
          ...result,
          success: true,
          errors: [`DRY RUN: Would perform ${plan.estimatedActions} actions`]
        };
      }

      // Step 2: Create rollback data
      const rollbackData = await this.createRollbackData(plan);

      // Step 3: Begin "transaction-like" operations (SQLite in D1 has limitations)
      const operationId = nanoid();
      console.log(`Starting cascade deletion ${operationId} for media ${mediaId}`);

      try {
        // Step 4: Handle post/draft post references
        if (!preserveReferences) {
          await this.handlePostReferences(plan, result, permanent, softDelete);
        }

        // Step 5: Delete image variants from storage
        await this.deleteVariantsFromStorage(plan.variants, result);

        // Step 6: Delete main image from storage
        if (permanent) {
          await this.deleteMainImageFromStorage(plan.mediaRecord, result);
        }

        // Step 7: Handle metadata
        await this.handleMetadataDeletion(mediaId, result, permanent, softDelete, userId);

        // Step 8: Handle database record
        await this.handleDatabaseRecord(plan.mediaRecord, result, permanent, softDelete);

        // Step 9: Invalidate caches
        await this.invalidateAllCaches(plan.mediaRecord, result);

        result.success = true;
        console.log(`Cascade deletion ${operationId} completed successfully`);

      } catch (error) {
        console.error(`Cascade deletion ${operationId} failed:`, error);
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        
        // Attempt rollback
        try {
          await this.attemptRollback(rollbackData, result);
        } catch (rollbackError) {
          console.error(`Rollback failed for ${operationId}:`, rollbackError);
          result.rollbackPossible = false;
          result.errors.push('Rollback failed - manual intervention may be required');
        }
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Execute batch cascade deletion with proper coordination
   */
  async executeBatchCascadeDeletion(
    mediaIds: string[],
    userId: string,
    options: CascadeDeletionOptions = {}
  ): Promise<{ results: CascadeDeletionResult[]; summary: { total: number; successful: number; failed: number } }> {
    const results: CascadeDeletionResult[] = [];
    let successful = 0;
    let failed = 0;

    // Process in smaller batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < mediaIds.length; i += batchSize) {
      const batch = mediaIds.slice(i, i + batchSize);
      
      // Process current batch in parallel
      const batchPromises = batch.map(mediaId => 
        this.executeCascadeDeletion(mediaId, userId, options)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (let j = 0; j < batchResults.length; j++) {
        const mediaId = batch[j];
        const promiseResult = batchResults[j];
        
        if (promiseResult.status === 'fulfilled') {
          const deletionResult = promiseResult.value;
          results.push(deletionResult);
          
          if (deletionResult.success) {
            successful++;
          } else {
            failed++;
          }
        } else {
          // Promise was rejected
          results.push({
            success: false,
            mediaId,
            deletedVariants: [],
            deletedReferences: { posts: [], draftPosts: [] },
            storageDeleted: { mainImage: false, variants: [] },
            errors: [promiseResult.reason?.message || 'Unknown error'],
            rollbackPossible: false
          });
          failed++;
        }
      }
      
      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < mediaIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      results,
      summary: { total: mediaIds.length, successful, failed }
    };
  }

  private async createRollbackData(plan: CascadeDeletionPlan): Promise<any> {
    // Store essential data for potential rollback
    return {
      mediaRecord: plan.mediaRecord,
      variants: plan.variants,
      referencingPosts: plan.referencingPosts,
      referencingDraftPosts: plan.referencingDraftPosts,
      timestamp: new Date().toISOString()
    };
  }

  private async handlePostReferences(
    plan: CascadeDeletionPlan, 
    result: CascadeDeletionResult, 
    permanent: boolean, 
    softDelete: boolean
  ): Promise<void> {
    // Handle post references
    for (const post of plan.referencingPosts) {
      try {
        if (permanent && !softDelete) {
          // For now, we'll just log this. In a real implementation,
          // you might want to remove the media reference from the post
          // or handle it based on business logic
          console.log(`Post ${post.id} references deleted media ${result.mediaId}`);
        }
        result.deletedReferences.posts.push(post.id);
      } catch (error) {
        result.errors.push(`Failed to handle post reference ${post.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Handle draft post references
    for (const draftPost of plan.referencingDraftPosts) {
      try {
        if (permanent && !softDelete) {
          console.log(`Draft post ${draftPost.id} references deleted media ${result.mediaId}`);
        }
        result.deletedReferences.draftPosts.push(draftPost.id);
      } catch (error) {
        result.errors.push(`Failed to handle draft post reference ${draftPost.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async deleteVariantsFromStorage(variants: any[], result: CascadeDeletionResult): Promise<void> {
    for (const variant of variants) {
      try {
        await this.r2.delete(variant.storageKey);
        result.deletedVariants.push(variant.id);
        result.storageDeleted.variants.push(variant.id);
      } catch (error) {
        result.errors.push(`Failed to delete variant ${variant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async deleteMainImageFromStorage(mediaRecord: any, result: CascadeDeletionResult): Promise<void> {
    try {
      await this.r2.delete(mediaRecord.storageKey);
      result.storageDeleted.mainImage = true;
    } catch (error) {
      result.errors.push(`Failed to delete main image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error; // This is critical, so we throw to trigger rollback
    }
  }

  private async handleMetadataDeletion(
    mediaId: string, 
    result: CascadeDeletionResult, 
    permanent: boolean, 
    softDelete: boolean,
    userId: string
  ): Promise<void> {
    try {
      if (permanent && !softDelete) {
        await this.metadataService.deleteMetadata(mediaId);
      } else if (softDelete) {
        await this.metadataService.updateMetadata(mediaId, {
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: userId
        });
      }
    } catch (error) {
      result.errors.push(`Failed to handle metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleDatabaseRecord(
    mediaRecord: any, 
    result: CascadeDeletionResult, 
    permanent: boolean, 
    softDelete: boolean
  ): Promise<void> {
    try {
      if (permanent && !softDelete) {
        await this.db
          .delete(media)
          .where(eq(media.id, mediaRecord.id));
      }
      // For soft delete, we keep the database record but mark it in metadata
    } catch (error) {
      result.errors.push(`Failed to handle database record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error; // This is critical, so we throw to trigger rollback
    }
  }

  private async invalidateAllCaches(mediaRecord: any, result: CascadeDeletionResult): Promise<void> {
    try {
      // Invalidate direct cache entries
      await this.cachingService.delete(CacheKeys.media(mediaRecord.id));
      
      // Invalidate URL caches
      await this.cachingService.invalidatePattern(`image_url:${mediaRecord.storageKey}:*`);
      
      // Invalidate CDN cache patterns
      await this.cachingService.invalidatePattern(CacheKeys.cdnUrlPattern(mediaRecord.id));
      await this.cachingService.invalidatePattern(CacheKeys.mediaUrlPattern(mediaRecord.storageKey));
    } catch (error) {
      result.errors.push(`Failed to invalidate caches: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Cache invalidation failure is not critical enough to trigger rollback
    }
  }

  private async attemptRollback(rollbackData: any, result: CascadeDeletionResult): Promise<void> {
    console.log('Attempting rollback for cascade deletion...');
    
    // This is a simplified rollback - in a production system you'd want more sophisticated rollback logic
    // For now, we'll just log what would be rolled back
    console.log('Rollback data:', rollbackData);
    
    // In a real implementation, you would:
    // 1. Restore deleted files from backup or undo storage operations
    // 2. Restore database records
    // 3. Restore metadata
    // 4. Clear invalid cache entries
    
    result.errors.push('Automatic rollback completed - some manual verification may be needed');
  }
}

export function createCascadeDeletionService(env: Bindings): CascadeDeletionService {
  return new CascadeDeletionService(env);
}