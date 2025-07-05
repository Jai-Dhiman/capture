import type { Bindings } from '@/types';

export interface CacheMetadata {
  key: string;
  contentType: string;
  size: number;
  createdAt: string;
  lastAccessed: string;
  hitCount: number;
  ttl: number;
  tags: string[];
  transformations?: {
    applied: string[];
    options: Record<string, any>;
  };
  invalidationRules?: string[];
}

export interface CacheMetricsData {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  averageResponseTime: number;
  cacheSize: number;
  keyCount: number;
  topKeys: Array<{ key: string; hits: number }>;
  recentActivity: Array<{
    timestamp: string;
    action: 'hit' | 'miss' | 'set' | 'delete';
    key: string;
  }>;
}

export interface KVMetadataService {
  setMetadata: (key: string, metadata: Partial<CacheMetadata>) => Promise<void>;
  getMetadata: (key: string) => Promise<CacheMetadata | null>;
  updateMetadata: (key: string, updates: Partial<CacheMetadata>) => Promise<void>;
  deleteMetadata: (key: string) => Promise<void>;
  recordAccess: (key: string) => Promise<void>;
  getMetrics: () => Promise<CacheMetricsData>;
  findByTag: (tag: string) => Promise<CacheMetadata[]>;
  findByPattern: (pattern: string) => Promise<CacheMetadata[]>;
  cleanup: (olderThan: Date) => Promise<number>;
}

export function createKVMetadataService(env: Bindings): KVMetadataService {
  const metadataPrefix = 'metadata:';
  const metricsKey = 'cache_metrics';
  const activityKey = 'cache_activity';
  
  return {
    async setMetadata(key: string, metadata: Partial<CacheMetadata>): Promise<void> {
      try {
        const metadataKey = `${metadataPrefix}${key}`;
        const now = new Date().toISOString();
        
        const fullMetadata: CacheMetadata = {
          key,
          contentType: metadata.contentType || 'unknown',
          size: metadata.size || 0,
          createdAt: now,
          lastAccessed: now,
          hitCount: 0,
          ttl: metadata.ttl || 300,
          tags: metadata.tags || [],
          transformations: metadata.transformations,
          invalidationRules: metadata.invalidationRules || [],
          ...metadata,
        };
        
        await env.CACHE_KV.put(metadataKey, JSON.stringify(fullMetadata), {
          expirationTtl: fullMetadata.ttl + 3600, // Metadata lives longer than cache
        });
        
        // Update metrics
        await this.updateCacheMetrics('set', key);
      } catch (error) {
        console.error('Failed to set cache metadata:', error);
      }
    },

    async getMetadata(key: string): Promise<CacheMetadata | null> {
      try {
        const metadataKey = `${metadataPrefix}${key}`;
        const metadata = await env.CACHE_KV.get(metadataKey, 'json');
        
        if (metadata) {
          return metadata as CacheMetadata;
        }
        
        return null;
      } catch (error) {
        console.error('Failed to get cache metadata:', error);
        return null;
      }
    },

    async updateMetadata(key: string, updates: Partial<CacheMetadata>): Promise<void> {
      try {
        const existingMetadata = await this.getMetadata(key);
        
        if (existingMetadata) {
          const updatedMetadata = {
            ...existingMetadata,
            ...updates,
          };
          
          await this.setMetadata(key, updatedMetadata);
        }
      } catch (error) {
        console.error('Failed to update cache metadata:', error);
      }
    },

    async deleteMetadata(key: string): Promise<void> {
      try {
        const metadataKey = `${metadataPrefix}${key}`;
        await env.CACHE_KV.delete(metadataKey);
        
        // Update metrics
        await this.updateCacheMetrics('delete', key);
      } catch (error) {
        console.error('Failed to delete cache metadata:', error);
      }
    },

    async recordAccess(key: string): Promise<void> {
      try {
        const metadata = await this.getMetadata(key);
        
        if (metadata) {
          const updates = {
            lastAccessed: new Date().toISOString(),
            hitCount: metadata.hitCount + 1,
          };
          
          await this.updateMetadata(key, updates);
        }
        
        // Update metrics
        await this.updateCacheMetrics('hit', key);
      } catch (error) {
        console.error('Failed to record cache access:', error);
      }
    },

    async getMetrics(): Promise<CacheMetricsData> {
      try {
        const metrics = await env.CACHE_KV.get(metricsKey, 'json') as CacheMetricsData | null;
        
        if (!metrics) {
          return this.getDefaultMetrics();
        }
        
        // Calculate derived metrics
        const hitRate = metrics.totalRequests > 0 ? (metrics.totalHits / metrics.totalRequests) * 100 : 0;
        const missRate = 100 - hitRate;
        
        return {
          ...metrics,
          hitRate,
          missRate,
        };
      } catch (error) {
        console.error('Failed to get cache metrics:', error);
        return this.getDefaultMetrics();
      }
    },

    async findByTag(tag: string): Promise<CacheMetadata[]> {
      try {
        const list = await env.CACHE_KV.list({ prefix: metadataPrefix });
        const results: CacheMetadata[] = [];
        
        for (const item of list.keys) {
          const metadata = await env.CACHE_KV.get(item.name, 'json') as CacheMetadata | null;
          
          if (metadata && metadata.tags.includes(tag)) {
            results.push(metadata);
          }
        }
        
        return results;
      } catch (error) {
        console.error('Failed to find metadata by tag:', error);
        return [];
      }
    },

    async findByPattern(pattern: string): Promise<CacheMetadata[]> {
      try {
        const list = await env.CACHE_KV.list({ prefix: metadataPrefix });
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const results: CacheMetadata[] = [];
        
        for (const item of list.keys) {
          const metadata = await env.CACHE_KV.get(item.name, 'json') as CacheMetadata | null;
          
          if (metadata && regex.test(metadata.key)) {
            results.push(metadata);
          }
        }
        
        return results;
      } catch (error) {
        console.error('Failed to find metadata by pattern:', error);
        return [];
      }
    },

    async cleanup(olderThan: Date): Promise<number> {
      try {
        const list = await env.CACHE_KV.list({ prefix: metadataPrefix });
        let deletedCount = 0;
        
        for (const item of list.keys) {
          const metadata = await env.CACHE_KV.get(item.name, 'json') as CacheMetadata | null;
          
          if (metadata && new Date(metadata.lastAccessed) < olderThan) {
            await env.CACHE_KV.delete(item.name);
            deletedCount++;
          }
        }
        
        return deletedCount;
      } catch (error) {
        console.error('Failed to cleanup metadata:', error);
        return 0;
      }
    },

    // Helper methods
    async updateCacheMetrics(action: 'hit' | 'miss' | 'set' | 'delete', key: string): Promise<void> {
      try {
        const metrics = await this.getMetrics();
        const now = new Date().toISOString();
        
        // Update counters
        if (action === 'hit') {
          metrics.totalHits++;
          metrics.totalRequests++;
        } else if (action === 'miss') {
          metrics.totalMisses++;
          metrics.totalRequests++;
        }
        
        // Update key tracking
        if (action === 'hit') {
          const existingKey = metrics.topKeys.find(k => k.key === key);
          if (existingKey) {
            existingKey.hits++;
          } else {
            metrics.topKeys.push({ key, hits: 1 });
          }
          
          // Keep only top 10 keys
          metrics.topKeys.sort((a, b) => b.hits - a.hits);
          metrics.topKeys = metrics.topKeys.slice(0, 10);
        }
        
        // Update recent activity
        metrics.recentActivity.unshift({
          timestamp: now,
          action,
          key,
        });
        
        // Keep only last 100 activities
        metrics.recentActivity = metrics.recentActivity.slice(0, 100);
        
        // Update key count
        if (action === 'set') {
          metrics.keyCount++;
        } else if (action === 'delete') {
          metrics.keyCount = Math.max(0, metrics.keyCount - 1);
        }
        
        await env.CACHE_KV.put(metricsKey, JSON.stringify(metrics), {
          expirationTtl: 86400, // 24 hours
        });
      } catch (error) {
        console.error('Failed to update cache metrics:', error);
      }
    },

    getDefaultMetrics(): CacheMetricsData {
      return {
        hitRate: 0,
        missRate: 0,
        totalRequests: 0,
        totalHits: 0,
        totalMisses: 0,
        averageResponseTime: 0,
        cacheSize: 0,
        keyCount: 0,
        topKeys: [],
        recentActivity: [],
      };
    },
  };
}

// Enhanced caching service with metadata tracking
export function createEnhancedCachingService(env: Bindings) {
  const metadataService = createKVMetadataService(env);
  const kv = env.CACHE_KV;
  
  return {
    async get<T>(key: string, recordAccess = true): Promise<T | null> {
      try {
        const value = await kv.get(key, 'json');
        
        if (value) {
          if (recordAccess) {
            await metadataService.recordAccess(key);
          }
          return value as T;
        }
        
        // Record miss
        await metadataService.updateCacheMetrics('miss', key);
        return null;
      } catch (error) {
        console.error('Enhanced cache get error:', error);
        return null;
      }
    },

    async set<T>(
      key: string,
      value: T,
      ttl = 300,
      metadata: Partial<CacheMetadata> = {}
    ): Promise<void> {
      try {
        await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
        
        // Set metadata
        await metadataService.setMetadata(key, {
          ...metadata,
          ttl,
          size: JSON.stringify(value).length,
        });
      } catch (error) {
        console.error('Enhanced cache set error:', error);
      }
    },

    async delete(key: string): Promise<void> {
      try {
        await kv.delete(key);
        await metadataService.deleteMetadata(key);
      } catch (error) {
        console.error('Enhanced cache delete error:', error);
      }
    },

    // Metadata service methods
    getMetadata: metadataService.getMetadata,
    getMetrics: metadataService.getMetrics,
    findByTag: metadataService.findByTag,
    findByPattern: metadataService.findByPattern,
    cleanup: metadataService.cleanup,
  };
}

// Cache tagging utilities
export const CacheTags = {
  // Content tags
  content: {
    post: (postId: string) => [`content:post:${postId}`, 'content:post'],
    user: (userId: string) => [`content:user:${userId}`, 'content:user'],
    media: (mediaId: string) => [`content:media:${mediaId}`, 'content:media'],
  },
  
  // System tags
  system: {
    embeddings: (model: string) => [`system:embeddings:${model}`, 'system:embeddings'],
    recommendations: (userId: string) => [`system:rec:${userId}`, 'system:rec'],
    transformations: (type: string) => [`system:transform:${type}`, 'system:transform'],
  },
  
  // Performance tags
  performance: {
    critical: () => ['performance:critical'],
    important: () => ['performance:important'],
    background: () => ['performance:background'],
  },
} as const;