import type { Bindings } from '../../types';
import { nanoid } from 'nanoid';
import { MetadataService } from './metadataService';
import { ImageSearchService } from './searchService';
import { 
  BulkMetadataOperation, 
  BulkOperationResult, 
  ImageMetadata,
  MetadataSearchQuery 
} from './metadata';

export class BulkOperationsService {
  private metadataService: MetadataService;
  private searchService: ImageSearchService;
  private kv: KVNamespace;

  constructor(env: Bindings) {
    this.metadataService = new MetadataService(env);
    this.searchService = new ImageSearchService(env);
    this.kv = env.METADATA_KV;
  }

  /**
   * Execute a bulk operation on multiple images
   */
  async executeBulkOperation(operation: BulkMetadataOperation): Promise<BulkOperationResult> {
    const operationId = nanoid();
    const result: BulkOperationResult = {
      operationId,
      totalItems: operation.imageIds.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
      completedAt: ''
    };

    // Store operation status
    await this.storeOperationStatus(operationId, 'running', operation);

    try {
      switch (operation.type) {
        case 'update':
          await this.bulkUpdateMetadata(operation, result);
          break;
        case 'delete':
          await this.bulkDeleteMetadata(operation, result);
          break;
        case 'tag':
          await this.bulkTagImages(operation, result);
          break;
        case 'categorize':
          await this.bulkCategorizeImages(operation, result);
          break;
        default:
          throw new Error(`Unsupported operation type: ${operation.type}`);
      }
    } catch (error) {
      result.errors.push({
        imageId: 'operation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      result.failureCount = result.totalItems;
    }

    result.completedAt = new Date().toISOString();
    await this.storeOperationStatus(operationId, 'completed', operation, result);

    return result;
  }

  /**
   * Get bulk operation status
   */
  async getOperationStatus(operationId: string): Promise<{
    status: 'running' | 'completed' | 'failed';
    operation: BulkMetadataOperation;
    result?: BulkOperationResult;
  } | null> {
    const statusData = await this.kv.get(`bulk_operation:${operationId}`);
    return statusData ? JSON.parse(statusData) : null;
  }

  /**
   * Bulk update metadata for multiple images
   */
  async bulkUpdateMetadata(operation: BulkMetadataOperation, result: BulkOperationResult): Promise<void> {
    const updates = operation.parameters as Partial<ImageMetadata>;
    
    for (const imageId of operation.imageIds) {
      try {
        await this.metadataService.updateMetadata(imageId, updates);
        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.errors.push({
          imageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Bulk delete metadata for multiple images
   */
  async bulkDeleteMetadata(operation: BulkMetadataOperation, result: BulkOperationResult): Promise<void> {
    for (const imageId of operation.imageIds) {
      try {
        await this.metadataService.deleteMetadata(imageId);
        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.errors.push({
          imageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Bulk add tags to multiple images
   */
  async bulkTagImages(operation: BulkMetadataOperation, result: BulkOperationResult): Promise<void> {
    const { tags, replace = false } = operation.parameters;
    
    if (!tags || !Array.isArray(tags)) {
      throw new Error('Tags parameter must be an array');
    }

    for (const imageId of operation.imageIds) {
      try {
        const metadata = await this.metadataService.getMetadata(imageId);
        if (!metadata) {
          result.errors.push({
            imageId,
            error: 'Metadata not found'
          });
          result.failureCount++;
          continue;
        }

        let updatedTags: string[];
        if (replace) {
          updatedTags = tags;
        } else {
          // Merge tags, avoiding duplicates
          const existingTags = new Set(metadata.tags);
          tags.forEach(tag => existingTags.add(tag));
          updatedTags = Array.from(existingTags);
        }

        await this.metadataService.updateMetadata(imageId, { tags: updatedTags });
        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.errors.push({
          imageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Bulk categorize multiple images
   */
  async bulkCategorizeImages(operation: BulkMetadataOperation, result: BulkOperationResult): Promise<void> {
    const { category } = operation.parameters;
    
    if (!category || typeof category !== 'string') {
      throw new Error('Category parameter must be a string');
    }

    for (const imageId of operation.imageIds) {
      try {
        await this.metadataService.updateMetadata(imageId, { category });
        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.errors.push({
          imageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Bulk operation based on search query
   */
  async executeBulkOperationByQuery(
    query: MetadataSearchQuery,
    operationType: 'update' | 'delete' | 'tag' | 'categorize',
    parameters: Record<string, any>,
    userId: string
  ): Promise<BulkOperationResult> {
    // First, perform the search to get matching image IDs
    const searchResult = await this.searchService.searchImages({
      ...query,
      limit: 1000 // Set a reasonable limit for bulk operations
    });

    const imageIds = searchResult.results.map(result => result.id);

    if (imageIds.length === 0) {
      return {
        operationId: nanoid(),
        totalItems: 0,
        successCount: 0,
        failureCount: 0,
        errors: [],
        completedAt: new Date().toISOString()
      };
    }

    const operation: BulkMetadataOperation = {
      type: operationType,
      imageIds,
      parameters,
      userId,
      requestedAt: new Date().toISOString()
    };

    return await this.executeBulkOperation(operation);
  }

  /**
   * Bulk remove tags from multiple images
   */
  async bulkRemoveTags(imageIds: string[], tagsToRemove: string[], userId: string): Promise<BulkOperationResult> {
    const operationId = nanoid();
    const result: BulkOperationResult = {
      operationId,
      totalItems: imageIds.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
      completedAt: ''
    };

    for (const imageId of imageIds) {
      try {
        const metadata = await this.metadataService.getMetadata(imageId);
        if (!metadata) {
          result.errors.push({
            imageId,
            error: 'Metadata not found'
          });
          result.failureCount++;
          continue;
        }

        // Verify user ownership
        if (metadata.userId !== userId) {
          result.errors.push({
            imageId,
            error: 'Access denied'
          });
          result.failureCount++;
          continue;
        }

        // Remove specified tags
        const updatedTags = metadata.tags.filter(tag => !tagsToRemove.includes(tag));

        await this.metadataService.updateMetadata(imageId, { tags: updatedTags });
        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.errors.push({
          imageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    result.completedAt = new Date().toISOString();
    return result;
  }

  /**
   * Bulk update visibility for multiple images
   */
  async bulkUpdateVisibility(
    imageIds: string[], 
    visibility: 'public' | 'private' | 'unlisted', 
    userId: string
  ): Promise<BulkOperationResult> {
    const operation: BulkMetadataOperation = {
      type: 'update',
      imageIds,
      parameters: { visibility },
      userId,
      requestedAt: new Date().toISOString()
    };

    return await this.executeBulkOperation(operation);
  }

  /**
   * Get user's recent bulk operations
   */
  async getUserBulkOperations(userId: string, limit = 10): Promise<Array<{
    operationId: string;
    operation: BulkMetadataOperation;
    result?: BulkOperationResult;
    status: string;
  }>> {
    // In a real implementation, you'd want to maintain an index of operations by user
    // For now, this is a simplified version
    const list = await this.kv.list({ prefix: 'bulk_operation:' });
    const operations = [];

    for (const item of list.keys.slice(0, limit * 2)) { // Get more to filter
      const data = await this.kv.get(item.name);
      if (data) {
        const operationData = JSON.parse(data);
        if (operationData.operation.userId === userId) {
          operations.push({
            operationId: item.name.replace('bulk_operation:', ''),
            ...operationData
          });
        }
      }
    }

    return operations
      .sort((a, b) => new Date(b.operation.requestedAt).getTime() - new Date(a.operation.requestedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Cancel a running bulk operation
   */
  async cancelOperation(operationId: string, userId: string): Promise<boolean> {
    const statusData = await this.kv.get(`bulk_operation:${operationId}`);
    if (!statusData) {
      return false;
    }

    const operationData = JSON.parse(statusData);
    
    // Verify user ownership
    if (operationData.operation.userId !== userId) {
      throw new Error('Access denied');
    }

    // Only cancel if still running
    if (operationData.status === 'running') {
      await this.storeOperationStatus(operationId, 'cancelled', operationData.operation);
      return true;
    }

    return false;
  }

  /**
   * Store operation status in KV
   */
  private async storeOperationStatus(
    operationId: string,
    status: 'running' | 'completed' | 'failed' | 'cancelled',
    operation: BulkMetadataOperation,
    result?: BulkOperationResult
  ): Promise<void> {
    const statusData = {
      status,
      operation,
      result,
      updatedAt: new Date().toISOString()
    };

    await this.kv.put(`bulk_operation:${operationId}`, JSON.stringify(statusData), {
      expirationTtl: 86400 // 24 hours
    });
  }
}

export function createBulkOperationsService(env: Bindings): BulkOperationsService {
  return new BulkOperationsService(env);
}