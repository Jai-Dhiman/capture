import type { Bindings } from '@/types';
import { createEnhancedInvalidationService } from './enhancedInvalidation';

export interface RealTimeInvalidationConfig {
  enabled: boolean;
  broadcastChannels: string[];
  queueProcessing: {
    enabled: boolean;
    batchSize: number;
    processInterval: number; // milliseconds
    maxRetries: number;
  };
  websocket: {
    enabled: boolean;
    channels: Record<string, string[]>; // channel -> patterns
  };
  notifications: {
    enabled: boolean;
    webhookUrl?: string;
    emailNotifications?: boolean;
  };
}

export interface InvalidationQueueItem {
  id: string;
  pattern: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;
  scheduledFor?: string;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface RealTimeInvalidationService {
  // Queue management
  enqueueInvalidation: (pattern: string, priority?: string, delay?: number) => Promise<string>;
  processQueue: () => Promise<void>;
  getQueueStatus: () => Promise<{ pending: number; processing: number; failed: number }>;
  retryFailedItems: (maxAge?: number) => Promise<number>;
  
  // Real-time broadcasting
  broadcastInvalidation: (pattern: string, channels?: string[]) => Promise<void>;
  subscribeToInvalidations: (callback: (pattern: string, metadata?: any) => void) => void;
  
  // WebSocket integration
  handleWebSocketMessage: (message: any, websocket: WebSocket) => Promise<void>;
  broadcastToWebSockets: (pattern: string, metadata?: any) => Promise<void>;
  
  // Scheduled invalidations
  scheduleInvalidation: (pattern: string, scheduledFor: Date, priority?: string) => Promise<string>;
  processPendingScheduled: () => Promise<void>;
  
  // Notifications
  sendNotification: (event: InvalidationNotificationEvent) => Promise<void>;
  
  // Configuration
  updateConfig: (config: Partial<RealTimeInvalidationConfig>) => Promise<void>;
  getConfig: () => Promise<RealTimeInvalidationConfig>;
}

export interface InvalidationNotificationEvent {
  type: 'invalidation_started' | 'invalidation_completed' | 'invalidation_failed' | 'queue_overload';
  pattern?: string;
  itemsInvalidated?: number;
  duration?: number;
  error?: string;
  queueSize?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export function createRealTimeInvalidationService(env: Bindings): RealTimeInvalidationService {
  const invalidationService = createEnhancedInvalidationService(env);
  const queueKey = 'invalidation_queue';
  const configKey = 'realtime_invalidation_config';
  const subscribersKey = 'invalidation_subscribers';
  
  // Default configuration
  const defaultConfig: RealTimeInvalidationConfig = {
    enabled: true,
    broadcastChannels: ['cache_invalidation', 'system_events'],
    queueProcessing: {
      enabled: true,
      batchSize: 10,
      processInterval: 5000, // 5 seconds
      maxRetries: 3,
    },
    websocket: {
      enabled: true,
      channels: {
        'user_updates': ['user:*', 'profile:*'],
        'content_updates': ['post:*', 'media:*'],
        'system_updates': ['system:*', 'admin:*'],
      },
    },
    notifications: {
      enabled: true,
      emailNotifications: false,
    },
  };

  return {
    async enqueueInvalidation(
      pattern: string, 
      priority: string = 'medium', 
      delay: number = 0
    ): Promise<string> {
      try {
        const itemId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();
        const scheduledFor = delay > 0 ? new Date(now.getTime() + delay) : now;
        
        const queueItem: InvalidationQueueItem = {
          id: itemId,
          pattern,
          priority: priority as any,
          createdAt: now.toISOString(),
          scheduledFor: scheduledFor.toISOString(),
          retryCount: 0,
          maxRetries: 3,
          status: 'pending',
        };
        
        // Get current queue
        const queue = await this.getQueue();
        queue.push(queueItem);
        
        // Sort by priority and scheduled time
        queue.sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const aPriority = priorityOrder[a.priority];
          const bPriority = priorityOrder[b.priority];
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority;
          }
          
          return new Date(a.scheduledFor || a.createdAt).getTime() - 
                 new Date(b.scheduledFor || b.createdAt).getTime();
        });
        
        await this.saveQueue(queue);
        
        // Broadcast to real-time channels
        await this.broadcastInvalidation(pattern, ['cache_invalidation']);
        
        return itemId;
      } catch (error) {
        console.error('Failed to enqueue invalidation:', error);
        throw error;
      }
    },

    async processQueue(): Promise<void> {
      try {
        const config = await this.getConfig();
        
        if (!config.queueProcessing.enabled) {
          return;
        }
        
        const queue = await this.getQueue();
        const now = new Date();
        
        // Get items ready for processing
        const readyItems = queue
          .filter(item => 
            item.status === 'pending' && 
            new Date(item.scheduledFor || item.createdAt) <= now
          )
          .slice(0, config.queueProcessing.batchSize);
        
        if (readyItems.length === 0) {
          return;
        }
        
        // Process items in parallel
        const results = await Promise.allSettled(
          readyItems.map(item => this.processQueueItem(item))
        );
        
        // Update queue with results
        results.forEach((result, index) => {
          const item = readyItems[index];
          const queueIndex = queue.findIndex(q => q.id === item.id);
          
          if (queueIndex !== -1) {
            if (result.status === 'fulfilled') {
              queue[queueIndex].status = 'completed';
              
              // Send success notification
              this.sendNotification({
                type: 'invalidation_completed',
                pattern: item.pattern,
                itemsInvalidated: result.value.itemsInvalidated,
                duration: result.value.duration,
                timestamp: new Date().toISOString(),
              }).catch(console.error);
            } else {
              queue[queueIndex].status = 'failed';
              queue[queueIndex].error = result.reason?.message || 'Unknown error';
              
              // Retry if under max retries
              if (queue[queueIndex].retryCount < queue[queueIndex].maxRetries) {
                queue[queueIndex].retryCount++;
                queue[queueIndex].status = 'pending';
                queue[queueIndex].scheduledFor = new Date(Date.now() + 60000).toISOString(); // Retry in 1 minute
              } else {
                // Send failure notification
                this.sendNotification({
                  type: 'invalidation_failed',
                  pattern: item.pattern,
                  error: queue[queueIndex].error,
                  timestamp: new Date().toISOString(),
                }).catch(console.error);
              }
            }
          }
        });
        
        await this.saveQueue(queue);
        
        // Check for queue overload
        const pendingCount = queue.filter(item => item.status === 'pending').length;
        if (pendingCount > 100) {
          await this.sendNotification({
            type: 'queue_overload',
            queueSize: pendingCount,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Failed to process invalidation queue:', error);
      }
    },

    async getQueueStatus(): Promise<{ pending: number; processing: number; failed: number }> {
      try {
        const queue = await this.getQueue();
        
        return {
          pending: queue.filter(item => item.status === 'pending').length,
          processing: queue.filter(item => item.status === 'processing').length,
          failed: queue.filter(item => item.status === 'failed').length,
        };
      } catch (error) {
        console.error('Failed to get queue status:', error);
        return { pending: 0, processing: 0, failed: 0 };
      }
    },

    async retryFailedItems(maxAge: number = 3600000): Promise<number> {
      try {
        const queue = await this.getQueue();
        const cutoff = new Date(Date.now() - maxAge);
        let retriedCount = 0;
        
        queue.forEach(item => {
          if (item.status === 'failed' && 
              new Date(item.createdAt) > cutoff && 
              item.retryCount < item.maxRetries) {
            item.status = 'pending';
            item.retryCount++;
            item.scheduledFor = new Date().toISOString();
            retriedCount++;
          }
        });
        
        if (retriedCount > 0) {
          await this.saveQueue(queue);
        }
        
        return retriedCount;
      } catch (error) {
        console.error('Failed to retry failed items:', error);
        return 0;
      }
    },

    async broadcastInvalidation(pattern: string, channels: string[] = []): Promise<void> {
      try {
        const config = await this.getConfig();
        const targetChannels = channels.length > 0 ? channels : config.broadcastChannels;
        
        const message = {
          type: 'cache_invalidation',
          pattern,
          timestamp: new Date().toISOString(),
        };
        
        // Broadcast to configured channels (implementation depends on your messaging system)
        for (const channel of targetChannels) {
          // This would integrate with your real-time messaging system
          // For example, using Cloudflare Durable Objects, WebPush, or external services
          console.log(`Broadcasting to channel ${channel}:`, message);
        }
        
        // Broadcast to WebSockets
        await this.broadcastToWebSockets(pattern, message);
      } catch (error) {
        console.error('Failed to broadcast invalidation:', error);
      }
    },

    subscribeToInvalidations(callback: (pattern: string, metadata?: any) => void): void {
      // This would typically register with your real-time messaging system
      // For now, we'll store the callback for WebSocket handling
      console.log('Subscribed to invalidation events');
    },

    async handleWebSocketMessage(message: any, websocket: WebSocket): Promise<void> {
      try {
        if (message.type === 'subscribe_invalidations') {
          const channels = message.channels || [];
          
          // Store WebSocket subscription
          // Implementation depends on your WebSocket management system
          console.log('WebSocket subscribed to invalidation channels:', channels);
          
          websocket.send(JSON.stringify({
            type: 'subscription_confirmed',
            channels,
            timestamp: new Date().toISOString(),
          }));
        } else if (message.type === 'trigger_invalidation') {
          const { pattern, priority = 'medium' } = message;
          
          if (pattern) {
            await this.enqueueInvalidation(pattern, priority);
            
            websocket.send(JSON.stringify({
              type: 'invalidation_triggered',
              pattern,
              timestamp: new Date().toISOString(),
            }));
          }
        }
      } catch (error) {
        console.error('Failed to handle WebSocket message:', error);
        websocket.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          timestamp: new Date().toISOString(),
        }));
      }
    },

    async broadcastToWebSockets(pattern: string, metadata?: any): Promise<void> {
      try {
        const config = await this.getConfig();
        
        if (!config.websocket.enabled) {
          return;
        }
        
        // Determine which channels should receive this pattern
        const matchingChannels = Object.entries(config.websocket.channels)
          .filter(([channel, patterns]) => 
            patterns.some(p => this.patternMatches(pattern, p))
          )
          .map(([channel]) => channel);
        
        const message = {
          type: 'cache_invalidation',
          pattern,
          channels: matchingChannels,
          timestamp: new Date().toISOString(),
          ...metadata,
        };
        
        // This would broadcast to all connected WebSockets
        // Implementation depends on your WebSocket management system
        console.log('Broadcasting to WebSockets:', message);
      } catch (error) {
        console.error('Failed to broadcast to WebSockets:', error);
      }
    },

    async scheduleInvalidation(
      pattern: string, 
      scheduledFor: Date, 
      priority: string = 'medium'
    ): Promise<string> {
      const delay = scheduledFor.getTime() - Date.now();
      return await this.enqueueInvalidation(pattern, priority, delay);
    },

    async processPendingScheduled(): Promise<void> {
      // This is handled by the regular processQueue method
      await this.processQueue();
    },

    async sendNotification(event: InvalidationNotificationEvent): Promise<void> {
      try {
        const config = await this.getConfig();
        
        if (!config.notifications.enabled) {
          return;
        }
        
        // Log notification
        console.log('Invalidation notification:', event);
        
        // Send webhook notification
        if (config.notifications.webhookUrl) {
          try {
            await fetch(config.notifications.webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(event),
            });
          } catch (error) {
            console.error('Failed to send webhook notification:', error);
          }
        }
        
        // Send email notification (if configured)
        if (config.notifications.emailNotifications && event.type === 'invalidation_failed') {
          // Implementation would depend on your email service
          console.log('Would send email notification for failed invalidation');
        }
      } catch (error) {
        console.error('Failed to send notification:', error);
      }
    },

    async updateConfig(config: Partial<RealTimeInvalidationConfig>): Promise<void> {
      try {
        const currentConfig = await this.getConfig();
        const updatedConfig = { ...currentConfig, ...config };
        
        await env.CACHE_KV.put(configKey, JSON.stringify(updatedConfig), {
          expirationTtl: 86400 * 7, // 7 days
        });
      } catch (error) {
        console.error('Failed to update real-time invalidation config:', error);
        throw error;
      }
    },

    async getConfig(): Promise<RealTimeInvalidationConfig> {
      try {
        const stored = await env.CACHE_KV.get(configKey, 'json');
        return stored ? { ...defaultConfig, ...stored } : defaultConfig;
      } catch (error) {
        console.error('Failed to get real-time invalidation config:', error);
        return defaultConfig;
      }
    },

    // Helper methods
    async getQueue(): Promise<InvalidationQueueItem[]> {
      try {
        const queue = await env.CACHE_KV.get(queueKey, 'json');
        return (queue as InvalidationQueueItem[]) || [];
      } catch (error) {
        console.error('Failed to get invalidation queue:', error);
        return [];
      }
    },

    async saveQueue(queue: InvalidationQueueItem[]): Promise<void> {
      try {
        // Remove completed items older than 1 hour
        const oneHourAgo = new Date(Date.now() - 3600000);
        const filteredQueue = queue.filter(item => 
          item.status !== 'completed' || 
          new Date(item.createdAt) > oneHourAgo
        );
        
        await env.CACHE_KV.put(queueKey, JSON.stringify(filteredQueue), {
          expirationTtl: 86400, // 24 hours
        });
      } catch (error) {
        console.error('Failed to save invalidation queue:', error);
        throw error;
      }
    },

    async processQueueItem(item: InvalidationQueueItem): Promise<any> {
      try {
        // Mark as processing
        item.status = 'processing';
        
        // Send start notification
        await this.sendNotification({
          type: 'invalidation_started',
          pattern: item.pattern,
          timestamp: new Date().toISOString(),
        });
        
        // Perform the invalidation
        const result = await invalidationService.invalidateByPattern(item.pattern, {
          priority: item.priority,
          trackPerformance: true,
        });
        
        return result;
      } catch (error) {
        console.error('Failed to process queue item:', error);
        throw error;
      }
    },

    patternMatches(pattern: string, rulePattern: string): boolean {
      try {
        const regex = new RegExp(
          rulePattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
        );
        return regex.test(pattern);
      } catch {
        return false;
      }
    },
  };
}

// Queue processor for scheduled execution
export async function startInvalidationQueueProcessor(env: Bindings) {
  const realTimeService = createRealTimeInvalidationService(env);
  const config = await realTimeService.getConfig();
  
  if (!config.queueProcessing.enabled) {
    console.log('Invalidation queue processing is disabled');
    return;
  }
  
  console.log('Starting invalidation queue processor...');
  
  // Process queue at regular intervals
  const processQueue = async () => {
    try {
      await realTimeService.processQueue();
    } catch (error) {
      console.error('Queue processing error:', error);
    }
  };
  
  // Initial processing
  await processQueue();
  
  // Schedule regular processing
  setInterval(processQueue, config.queueProcessing.processInterval);
  
  // Retry failed items every 10 minutes
  setInterval(async () => {
    try {
      const retriedCount = await realTimeService.retryFailedItems();
      if (retriedCount > 0) {
        console.log(`Retried ${retriedCount} failed invalidation items`);
      }
    } catch (error) {
      console.error('Failed to retry invalidation items:', error);
    }
  }, 600000); // 10 minutes
}

// WebSocket message handler for real-time invalidation
export function createInvalidationWebSocketHandler(env: Bindings) {
  const realTimeService = createRealTimeInvalidationService(env);
  
  return async (websocket: WebSocket, message: string) => {
    try {
      const parsed = JSON.parse(message);
      await realTimeService.handleWebSocketMessage(parsed, websocket);
    } catch (error) {
      console.error('WebSocket invalidation handler error:', error);
      websocket.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString(),
      }));
    }
  };
}

// Utility functions for integration
export const InvalidationTriggers = {
  immediate: async (env: Bindings, pattern: string) => {
    const service = createRealTimeInvalidationService(env);
    return await service.enqueueInvalidation(pattern, 'critical', 0);
  },
  
  delayed: async (env: Bindings, pattern: string, delayMs: number) => {
    const service = createRealTimeInvalidationService(env);
    return await service.enqueueInvalidation(pattern, 'medium', delayMs);
  },
  
  scheduled: async (env: Bindings, pattern: string, scheduledFor: Date) => {
    const service = createRealTimeInvalidationService(env);
    return await service.scheduleInvalidation(pattern, scheduledFor);
  },
  
  broadcast: async (env: Bindings, pattern: string, channels?: string[]) => {
    const service = createRealTimeInvalidationService(env);
    return await service.broadcastInvalidation(pattern, channels);
  },
};