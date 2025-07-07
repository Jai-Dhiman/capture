import type { Bindings } from '../../types';
import { createCachingService, CacheKeys, CacheTTL, type CachingService } from '../cache/cachingService';
import { 
  ImageMetadata, 
  MetadataSearchQuery,
  MetadataSearchResult
} from './metadata';

export class ImageSearchService {
  private kv: KVNamespace;
  private cachingService: CachingService;

  constructor(env: Bindings) {
    this.kv = env.METADATA_KV;
    this.cachingService = createCachingService(env);
  }

  /**
   * Search images using metadata queries
   */
  async searchImages(query: MetadataSearchQuery): Promise<MetadataSearchResult> {
    const cacheKey = this.generateSearchCacheKey(query);
    
    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        const results = await this.performSearch(query);
        return results;
      },
      CacheTTL.MEDIUM // 5 minutes cache for search results
    );
  }

  /**
   * Search by tags
   */
  async searchByTags(tags: string[], userId?: string): Promise<string[]> {
    const allImageIds = new Set<string>();

    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const tagData = await this.kv.get(tagKey);
      
      if (tagData) {
        const imageIds = JSON.parse(tagData) as string[];
        imageIds.forEach(id => allImageIds.add(id));
      }
    }

    let results = Array.from(allImageIds);

    // Filter by user if specified
    if (userId) {
      const userKey = `user:${userId}`;
      const userData = await this.kv.get(userKey);
      
      if (userData) {
        const userImageIds = new Set(JSON.parse(userData) as string[]);
        results = results.filter(id => userImageIds.has(id));
      } else {
        results = [];
      }
    }

    return results;
  }

  /**
   * Search by user
   */
  async searchByUser(userId: string, options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'uploadedAt' | 'size';
    sortOrder?: 'asc' | 'desc';
  }): Promise<string[]> {
    const userKey = `user:${userId}`;
    const userData = await this.kv.get(userKey);
    
    if (!userData) {
      return [];
    }

    let imageIds = JSON.parse(userData) as string[];

    // Apply sorting if specified
    if (options?.sortBy) {
      const metadataPromises = imageIds.map(async (id) => {
        const searchKey = `search:${id}`;
        const searchData = await this.kv.get(searchKey);
        return searchData ? { id, ...JSON.parse(searchData) } : null;
      });

      const metadataList = (await Promise.all(metadataPromises)).filter(Boolean);
      
      metadataList.sort((a, b) => {
        if (!a || !b) return 0;
        
        const aValue = a[options.sortBy!];
        const bValue = b[options.sortBy!];
        
        if (options.sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
      });

      imageIds = metadataList.map(item => item!.id);
    }

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    
    return imageIds.slice(offset, offset + limit);
  }

  /**
   * Get faceted search results
   */
  async getFacets(query: MetadataSearchQuery): Promise<{
    formats: Array<{ value: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
    categories: Array<{ value: string; count: number }>;
    sizes: Array<{ range: string; count: number }>;
  }> {
    const imageIds = await this.getFilteredImageIds(query);
    
    // Get metadata for all matching images
    const metadataPromises = imageIds.map(async (id) => {
      const searchKey = `search:${id}`;
      const searchData = await this.kv.get(searchKey);
      return searchData ? JSON.parse(searchData) : null;
    });

    const metadataList = (await Promise.all(metadataPromises)).filter(Boolean);

    // Calculate facets
    const formatCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const sizeCounts = new Map<string, number>();

    for (const metadata of metadataList) {
      // Format facets
      if (metadata.format) {
        formatCounts.set(metadata.format, (formatCounts.get(metadata.format) || 0) + 1);
      }

      // Tag facets
      if (metadata.tags) {
        for (const tag of metadata.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      // Category facets
      if (metadata.category) {
        categoryCounts.set(metadata.category, (categoryCounts.get(metadata.category) || 0) + 1);
      }

      // Size facets
      if (metadata.size) {
        const sizeRange = this.getSizeRange(metadata.size);
        sizeCounts.set(sizeRange, (sizeCounts.get(sizeRange) || 0) + 1);
      }
    }

    return {
      formats: Array.from(formatCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      tags: Array.from(tagCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20), // Limit to top 20 tags
      categories: Array.from(categoryCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      sizes: Array.from(sizeCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => this.compareSizeRanges(a.value, b.value))
    };
  }

  /**
   * Perform the actual search logic
   */
  private async performSearch(query: MetadataSearchQuery): Promise<MetadataSearchResult> {
    const imageIds = await this.getFilteredImageIds(query);
    
    // Get metadata for results
    const metadataPromises = imageIds.map(async (id) => {
      const searchKey = `search:${id}`;
      const searchData = await this.kv.get(searchKey);
      return searchData ? { id, ...JSON.parse(searchData) } : null;
    });

    const searchResults = (await Promise.all(metadataPromises)).filter(Boolean);

    // Apply sorting
    if (query.sortBy) {
      searchResults.sort((a, b) => {
        if (!a || !b) return 0;
        
        const aValue = a[query.sortBy!];
        const bValue = b[query.sortBy!];
        
        if (query.sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
      });
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    const total = searchResults.length;
    const paginatedResults = searchResults.slice(offset, offset + limit);

    // Convert search results back to full metadata
    // Note: This is a simplified version - in production you'd want to store
    // full metadata in KV or fetch from R2
    const results: ImageMetadata[] = paginatedResults.map(result => ({
      ...result,
      variants: [],
      transformations: [],
      tags: result.tags || []
    } as ImageMetadata));

    return {
      results,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
      facets: await this.getFacets(query)
    };
  }

  /**
   * Get filtered image IDs based on query parameters
   */
  private async getFilteredImageIds(query: MetadataSearchQuery): Promise<string[]> {
    let candidateIds = new Set<string>();

    // Start with user filter if specified
    if (query.userId) {
      const userResults = await this.searchByUser(query.userId);
      candidateIds = new Set(userResults);
    }

    // Apply tag filters
    if (query.tags && query.tags.length > 0) {
      const tagResults = await this.searchByTags(query.tags, query.userId);
      if (candidateIds.size === 0) {
        candidateIds = new Set(tagResults);
      } else {
        // Intersection with existing candidates
        candidateIds = new Set(tagResults.filter(id => candidateIds.has(id)));
      }
    }

    // If no specific filters, get all images for the user or globally
    if (candidateIds.size === 0) {
      if (query.userId) {
        const userResults = await this.searchByUser(query.userId);
        candidateIds = new Set(userResults);
      } else {
        // For global search, we'd need a different approach
        // This is a simplified implementation
        const list = await this.kv.list({ prefix: 'search:' });
        candidateIds = new Set(list.keys.map(key => key.name.replace('search:', '')));
      }
    }

    // Apply additional filters
    const filteredIds = [];
    for (const id of candidateIds) {
      const searchKey = `search:${id}`;
      const searchData = await this.kv.get(searchKey);
      
      if (searchData) {
        const metadata = JSON.parse(searchData);
        
        if (this.matchesQuery(metadata, query)) {
          filteredIds.push(id);
        }
      }
    }

    return filteredIds;
  }

  /**
   * Check if metadata matches query filters
   */
  private matchesQuery(metadata: any, query: MetadataSearchQuery): boolean {
    // Text search
    if (query.query) {
      const searchText = query.query.toLowerCase();
      const searchableText = [
        metadata.filename,
        metadata.description,
        metadata.altText,
        ...(metadata.tags || [])
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchText)) {
        return false;
      }
    }

    // Category filter
    if (query.category && metadata.category !== query.category) {
      return false;
    }

    // Visibility filter
    if (query.visibility && metadata.visibility !== query.visibility) {
      return false;
    }

    // Size filters
    if (query.minSize && metadata.size < query.minSize) return false;
    if (query.maxSize && metadata.size > query.maxSize) return false;

    // Dimension filters
    if (query.minWidth && metadata.width < query.minWidth) return false;
    if (query.maxWidth && metadata.width > query.maxWidth) return false;
    if (query.minHeight && metadata.height < query.minHeight) return false;
    if (query.maxHeight && metadata.height > query.maxHeight) return false;

    // Format filter
    if (query.formats && !query.formats.includes(metadata.format)) {
      return false;
    }

    // Date filters
    if (query.uploadedAfter && metadata.uploadedAt < query.uploadedAfter) {
      return false;
    }
    if (query.uploadedBefore && metadata.uploadedAt > query.uploadedBefore) {
      return false;
    }

    return true;
  }

  /**
   * Generate cache key for search query
   */
  private generateSearchCacheKey(query: MetadataSearchQuery): string {
    const keyParts = [
      'search',
      query.query || '',
      query.tags?.join(',') || '',
      query.userId || '',
      query.category || '',
      query.visibility || '',
      query.sortBy || '',
      query.sortOrder || '',
      query.offset || 0,
      query.limit || 20
    ];

    return keyParts.join(':');
  }

  /**
   * Get size range for faceting
   */
  private getSizeRange(size: number): string {
    if (size < 100 * 1024) return '<100KB';
    if (size < 500 * 1024) return '100KB-500KB';
    if (size < 1024 * 1024) return '500KB-1MB';
    if (size < 5 * 1024 * 1024) return '1MB-5MB';
    if (size < 10 * 1024 * 1024) return '5MB-10MB';
    return '>10MB';
  }

  /**
   * Compare size ranges for sorting
   */
  private compareSizeRanges(a: string, b: string): number {
    const order = ['<100KB', '100KB-500KB', '500KB-1MB', '1MB-5MB', '5MB-10MB', '>10MB'];
    return order.indexOf(a) - order.indexOf(b);
  }
}

export function createImageSearchService(env: Bindings): ImageSearchService {
  return new ImageSearchService(env);
}