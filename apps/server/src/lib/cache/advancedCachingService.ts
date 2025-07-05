import type { Bindings } from '@/types';
import { createCachingService, CacheKeys, CacheTTL } from './cachingService';
import { 
  createEdgeTransformationService, 
  type EdgeTransformationOptions,
  extractTransformationOptions,
  EdgeCache 
} from './edgeTransformations';
import { 
  createPatternInvalidationService, 
  type InvalidationEvent,
  InvalidationTriggers 
} from './patternInvalidation';
import { 
  createKVMetadataService, 
  createEnhancedCachingService,
  type CacheMetadata,
  CacheTags 
} from './kvMetadata';
import { 
  createPerformanceMonitoringService,
  type PerformanceMetrics 
} from './performanceMonitoring';

export interface AdvancedCachingOptions {
  transformation?: EdgeTransformationOptions;
  metadata?: Partial<CacheMetadata>;
  invalidationRules?: string[];
  tags?: string[];
  monitoring?: boolean;
  variant?: string;
}

export interface AdvancedCachingService {
  // Core caching operations
  get: <T>(key: string, options?: AdvancedCachingOptions) => Promise<T | null>;
  set: <T>(key: string, value: T, ttl?: number, options?: AdvancedCachingOptions) => Promise<void>;
  delete: (key: string) => Promise<void>;
  
  // Pattern-based operations
  invalidatePattern: (pattern: string) => Promise<number>;
  invalidateByEvent: (event: InvalidationEvent) => Promise<void>;
  
  // Transformation operations
  transformAndCache: <T>(
    key: string,
    value: T,
    transformOptions: EdgeTransformationOptions,
    ttl?: number
  ) => Promise<T>;
  
  // Metadata operations
  getMetadata: (key: string) => Promise<CacheMetadata | null>;
  findByTag: (tag: string) => Promise<CacheMetadata[]>;
  
  // Performance monitoring
  getPerformanceReport: (timeRange: { start: Date; end: Date }) => Promise<any>;
  detectAnomalies: () => Promise<any[]>;
  
  // Cache warming
  warmCache: (patterns: string[]) => Promise<void>;
  
  // Utilities
  getCacheKey: (baseKey: string, options?: AdvancedCachingOptions) => string;
  optimizeCache: () => Promise<{ cleaned: number; optimized: number }>;
}

export function createAdvancedCachingService(env: Bindings): AdvancedCachingService {
  const baseCachingService = createCachingService(env);
  const enhancedCachingService = createEnhancedCachingService(env);
  const edgeTransformationService = createEdgeTransformationService(env);
  const patternInvalidationService = createPatternInvalidationService(env);
  const metadataService = createKVMetadataService(env);
  const performanceService = createPerformanceMonitoringService(env);
  
  return {
    async get<T>(key: string, options: AdvancedCachingOptions = {}): Promise<T | null> {
      const startTime = Date.now();
      
      try {
        // Generate cache key with transformations
        const cacheKey = this.getCacheKey(key, options);
        
        // Get from enhanced caching service
        const value = await enhancedCachingService.get<T>(cacheKey, options.monitoring !== false);
        
        if (value && options.transformation) {
          // Apply edge transformations if needed
          const transformedValue = await this.applyTransformations(value, options.transformation);
          
          // Track transformation performance
          if (options.monitoring !== false) {
            const transformationTime = Date.now() - startTime;
            await performanceService.trackTransformationPerformance(
              Object.keys(options.transformation).join(','),
              transformationTime
            );
          }
          
          return transformedValue as T;
        }
        
        return value;
      } catch (error) {
        console.error('Advanced cache get error:', error);
        return null;
      }
    },

    async set<T>(
      key: string, 
      value: T, 
      ttl = CacheTTL.MEDIUM, 
      options: AdvancedCachingOptions = {}
    ): Promise<void> {
      try {
        const cacheKey = this.getCacheKey(key, options);
        
        // Apply transformations before caching
        let valueToCache = value;
        if (options.transformation) {
          valueToCache = await this.applyTransformations(value, options.transformation);
        }
        
        // Prepare metadata
        const metadata: Partial<CacheMetadata> = {
          contentType: typeof value === 'object' ? 'json' : typeof value,
          tags: options.tags || [],
          invalidationRules: options.invalidationRules || [],
          transformations: options.transformation ? {
            applied: Object.keys(options.transformation),
            options: options.transformation,
          } : undefined,
          ...options.metadata,
        };
        
        // Set with enhanced caching service
        await enhancedCachingService.set(cacheKey, valueToCache, ttl, metadata);
        
        // Add invalidation rules if specified
        if (options.invalidationRules) {
          for (const pattern of options.invalidationRules) {
            await patternInvalidationService.addRule({
              pattern,
              description: `Auto-generated rule for ${cacheKey}`,
              priority: 'medium',
            });
          }
        }
      } catch (error) {
        console.error('Advanced cache set error:', error);
        throw error;
      }
    },

    async delete(key: string): Promise<void> {
      try {
        await enhancedCachingService.delete(key);
        
        // Trigger invalidation event
        await this.invalidateByEvent({
          type: 'system_event',
          action: 'cache_delete',
          metadata: { key },
        });
      } catch (error) {
        console.error('Advanced cache delete error:', error);
        throw error;
      }
    },

    async invalidatePattern(pattern: string): Promise<number> {
      try {
        return await patternInvalidationService.invalidateByPattern(pattern);
      } catch (error) {
        console.error('Pattern invalidation error:', error);
        return 0;
      }
    },

    async invalidateByEvent(event: InvalidationEvent): Promise<void> {
      try {
        await patternInvalidationService.invalidateByEvent(event);
      } catch (error) {
        console.error('Event-based invalidation error:', error);
      }
    },

    async transformAndCache<T>(
      key: string,
      value: T,
      transformOptions: EdgeTransformationOptions,
      ttl = CacheTTL.MEDIUM
    ): Promise<T> {
      try {
        const transformedValue = await this.applyTransformations(value, transformOptions);
        
        const options: AdvancedCachingOptions = {
          transformation: transformOptions,
          tags: CacheTags.system.transformations(Object.keys(transformOptions).join(',')),
          metadata: {
            contentType: 'transformed',
          },
        };
        
        await this.set(key, transformedValue, ttl, options);
        return transformedValue;
      } catch (error) {
        console.error('Transform and cache error:', error);
        return value;
      }
    },

    async getMetadata(key: string): Promise<CacheMetadata | null> {
      return await metadataService.getMetadata(key);
    },

    async findByTag(tag: string): Promise<CacheMetadata[]> {
      return await metadataService.findByTag(tag);
    },

    async getPerformanceReport(timeRange: { start: Date; end: Date }) {
      return await performanceService.getReport(timeRange);
    },

    async detectAnomalies() {
      return await performanceService.detectAnomalies();
    },

    async warmCache(patterns: string[]): Promise<void> {
      try {
        for (const pattern of patterns) {
          const metadata = await metadataService.findByPattern(pattern);
          
          // Re-cache items that are about to expire
          for (const meta of metadata) {
            const expiresAt = new Date(meta.createdAt).getTime() + meta.ttl * 1000;
            const timeToExpiry = expiresAt - Date.now();
            
            // If expires within next hour, warm it
            if (timeToExpiry < 3600000) {
              console.log(`Warming cache for key: ${meta.key}`);
              // Note: In a real implementation, you'd have the original fetcher
              // For now, we just log the warming intent
            }
          }
        }
      } catch (error) {
        console.error('Cache warming error:', error);
      }
    },

    getCacheKey(baseKey: string, options: AdvancedCachingOptions = {}): string {
      if (options.transformation) {
        return edgeTransformationService.getCacheKey(baseKey, options.transformation);
      }
      
      let key = baseKey;
      
      // Add variant to key
      if (options.variant) {
        key += `:variant:${options.variant}`;
      }
      
      // Add tags to key for better organization
      if (options.tags && options.tags.length > 0) {
        key += `:tags:${options.tags.join(',')}`;
      }
      
      return key;
    },

    async optimizeCache(): Promise<{ cleaned: number; optimized: number }> {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        // Clean old metadata
        const cleaned = await metadataService.cleanup(thirtyDaysAgo);
        
        // Find and optimize frequently accessed items
        const metrics = await metadataService.getMetrics();
        const optimized = Math.min(metrics.topKeys.length, 10);
        
        // Extend TTL for frequently accessed items
        for (const { key } of metrics.topKeys.slice(0, 10)) {
          const metadata = await metadataService.getMetadata(key);
          if (metadata) {
            await metadataService.updateMetadata(key, {
              ttl: metadata.ttl * 1.5, // Extend TTL by 50%
            });
          }
        }
        
        return { cleaned, optimized };
      } catch (error) {
        console.error('Cache optimization error:', error);
        return { cleaned: 0, optimized: 0 };
      }
    },

    // Helper methods
    async applyTransformations<T>(value: T, options: EdgeTransformationOptions): Promise<T> {
      try {
        let transformedValue = value;
        
        // Apply content transformations
        if (typeof value === 'string') {
          transformedValue = await edgeTransformationService.transformContent(value, options) as T;
        }
        
        // Apply personalization
        if (options.userId) {
          transformedValue = await edgeTransformationService.personalizeContent(transformedValue, options) as T;
        }
        
        // Apply A/B testing
        if (options.experimentId && options.variant) {
          transformedValue = await edgeTransformationService.handleABTest(transformedValue, options) as T;
        }
        
        return transformedValue;
      } catch (error) {
        console.error('Transformation error:', error);
        return value;
      }
    },
  };
}

// Enhanced cache warming with advanced features
export async function runAdvancedCacheWarming(env: Bindings, options: {
  includeTransformations?: boolean;
  includePersonalization?: boolean;
  maxItems?: number;
} = {}) {
  const advancedCachingService = createAdvancedCachingService(env);
  
  try {
    const {
      includeTransformations = true,
      includePersonalization = false,
      maxItems = 100,
    } = options;
    
    // Get popular content to warm
    const popularTags = ['performance:critical', 'content:post', 'system:rec'];
    
    for (const tag of popularTags) {
      const items = await advancedCachingService.findByTag(tag);
      const limitedItems = items.slice(0, maxItems);
      
      for (const item of limitedItems) {
        try {
          // Warm base cache
          await advancedCachingService.get(item.key);
          
          // Warm with transformations
          if (includeTransformations && item.transformations) {
            await advancedCachingService.get(item.key, {
              transformation: item.transformations.options,
            });
          }
          
          // Warm personalized versions for active users
          if (includePersonalization) {
            // This would require getting active user IDs
            // Implementation depends on your user activity tracking
          }
        } catch (error) {
          console.error(`Failed to warm cache for ${item.key}:`, error);
        }
      }
    }
    
    console.log('Advanced cache warming completed');
  } catch (error) {
    console.error('Advanced cache warming failed:', error);
  }
}

// Cache middleware factory for automatic advanced caching
export function createAdvancedCacheMiddleware(env: Bindings) {
  const advancedCachingService = createAdvancedCachingService(env);
  
  return {
    // Request middleware
    async handleRequest(request: Request): Promise<Response | null> {
      try {
        const url = new URL(request.url);
        const cacheKey = `request:${request.method}:${url.pathname}${url.search}`;
        
        // Extract transformation options from request
        const transformationOptions = extractTransformationOptions(request);
        
        // Try to get cached response
        const cachedResponse = await advancedCachingService.get(cacheKey, {
          transformation: transformationOptions,
          monitoring: true,
        });
        
        if (cachedResponse) {
          return new Response(JSON.stringify(cachedResponse), {
            headers: {
              'Content-Type': 'application/json',
              'X-Cache-Status': 'hit',
              'X-Cache-Key': cacheKey,
              ...EdgeCache.headers.static,
            },
          });
        }
        
        return null; // Cache miss, continue to origin
      } catch (error) {
        console.error('Cache middleware error:', error);
        return null;
      }
    },
    
    // Response middleware
    async handleResponse(request: Request, response: Response): Promise<Response> {
      try {
        const url = new URL(request.url);
        const cacheKey = `request:${request.method}:${url.pathname}${url.search}`;
        
        // Only cache successful responses
        if (response.status === 200) {
          const responseData = await response.clone().json();
          const transformationOptions = extractTransformationOptions(request);
          
          // Cache the response
          await advancedCachingService.set(cacheKey, responseData, EdgeCache.TTL.DYNAMIC_CONTENT, {
            transformation: transformationOptions,
            tags: CacheTags.system.transformations('response'),
            metadata: {
              contentType: 'response',
            },
          });
          
          // Add cache headers
          response.headers.set('X-Cache-Status', 'miss');
          response.headers.set('X-Cache-Key', cacheKey);
        }
        
        return response;
      } catch (error) {
        console.error('Response caching error:', error);
        return response;
      }
    },
  };
}