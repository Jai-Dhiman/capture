import type { Bindings } from '@/types';
import { createCachingService, CacheKeys } from './cachingService';
import { createKVMetadataService } from './kvMetadata';

export interface AdvancedPatternRule {
  id: string;
  pattern: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
  conditions?: {
    userAction?: string[];
    contentType?: string[];
    timeRange?: {
      start: Date;
      end: Date;
    };
    userRoles?: string[];
    geographic?: string[];
    deviceType?: string[];
    customFilters?: Record<string, any>;
  };
  invalidationStrategy?: {
    immediate?: boolean;
    delayed?: number; // seconds
    batched?: boolean;
    cascading?: boolean;
    partial?: boolean;
  };
  monitoring?: {
    trackPerformance: boolean;
    alertOnFailure: boolean;
    logDetails: boolean;
  };
}

export interface BatchInvalidationJob {
  id: string;
  patterns: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  itemsProcessed: number;
  itemsTotal: number;
  errors: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface InvalidationMetrics {
  totalInvalidations: number;
  successfulInvalidations: number;
  failedInvalidations: number;
  averageInvalidationTime: number;
  patternPerformance: Record<string, {
    calls: number;
    totalTime: number;
    averageTime: number;
    successRate: number;
  }>;
  recentInvalidations: Array<{
    timestamp: string;
    pattern: string;
    itemsInvalidated: number;
    duration: number;
    success: boolean;
  }>;
}

export interface EnhancedInvalidationService {
  // Rule management
  addRule: (rule: AdvancedPatternRule) => Promise<void>;
  updateRule: (id: string, updates: Partial<AdvancedPatternRule>) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
  getRule: (id: string) => Promise<AdvancedPatternRule | null>;
  listRules: (filters?: { enabled?: boolean; priority?: string }) => Promise<AdvancedPatternRule[]>;
  
  // Pattern invalidation
  invalidateByPattern: (pattern: string, options?: InvalidationOptions) => Promise<InvalidationResult>;
  invalidateByRuleId: (ruleId: string, context?: InvalidationContext) => Promise<InvalidationResult>;
  invalidateMultiplePatterns: (patterns: string[], options?: BatchInvalidationOptions) => Promise<BatchInvalidationResult>;
  
  // Batch processing
  createBatchJob: (patterns: string[], priority?: 'critical' | 'high' | 'medium' | 'low') => Promise<string>;
  getBatchJob: (jobId: string) => Promise<BatchInvalidationJob | null>;
  executeBatchJob: (jobId: string) => Promise<void>;
  
  // Event-driven invalidation
  invalidateByEvent: (event: ExtendedInvalidationEvent) => Promise<void>;
  registerEventTrigger: (event: string, rules: string[]) => Promise<void>;
  
  // Analytics and monitoring
  getMetrics: (timeRange?: { start: Date; end: Date }) => Promise<InvalidationMetrics>;
  getPatternUsage: (pattern: string) => Promise<PatternUsageStats>;
  
  // Advanced pattern matching
  testPattern: (pattern: string, testKeys: string[]) => Promise<{ matches: string[]; nonMatches: string[] }>;
  optimizePattern: (pattern: string) => Promise<{ optimized: string; performance: number }>;
  
  // Content workflow integration
  onContentUpdate: (contentId: string, contentType: string, userId: string) => Promise<void>;
  onUserAction: (userId: string, action: string, targetId?: string) => Promise<void>;
}

export interface InvalidationOptions {
  immediate?: boolean;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  dryRun?: boolean;
  trackPerformance?: boolean;
  maxItems?: number;
  timeout?: number;
}

export interface InvalidationResult {
  success: boolean;
  itemsInvalidated: number;
  duration: number;
  errors: string[];
  pattern: string;
  dryRun?: boolean;
}

export interface BatchInvalidationOptions extends InvalidationOptions {
  batchSize?: number;
  parallelBatches?: number;
  failOnError?: boolean;
}

export interface BatchInvalidationResult {
  jobId: string;
  totalPatterns: number;
  processedPatterns: number;
  totalItemsInvalidated: number;
  totalDuration: number;
  results: InvalidationResult[];
  errors: string[];
}

export interface ExtendedInvalidationEvent {
  type: 'user_action' | 'content_update' | 'system_event' | 'scheduled' | 'manual';
  userId?: string;
  contentId?: string;
  contentType?: string;
  action?: string;
  userRole?: string;
  geographic?: string;
  deviceType?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface InvalidationContext {
  userId?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  reason?: string;
  dryRun?: boolean;
}

export interface PatternUsageStats {
  pattern: string;
  totalCalls: number;
  averageItemsInvalidated: number;
  averageDuration: number;
  successRate: number;
  lastUsed?: string;
  peakUsageTimes: string[];
}

export function createEnhancedInvalidationService(env: Bindings): EnhancedInvalidationService {
  const cachingService = createCachingService(env);
  const metadataService = createKVMetadataService(env);
  const rulesKey = 'enhanced_invalidation_rules';
  const metricsKey = 'invalidation_metrics';
  const batchJobsKey = 'batch_invalidation_jobs';
  
  return {
    async addRule(rule: AdvancedPatternRule): Promise<void> {
      try {
        // Validate rule
        if (!this.validateRule(rule)) {
          throw new Error('Invalid rule configuration');
        }
        
        const rules = await this.listRules();
        
        // Check for duplicate IDs
        if (rules.some(r => r.id === rule.id)) {
          throw new Error(`Rule with ID ${rule.id} already exists`);
        }
        
        rules.push({
          ...rule,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
          enabled: rule.enabled ?? true,
        });
        
        await cachingService.set(rulesKey, rules, 86400 * 7); // 7 days
        
        // Log rule creation
        console.log(`Added invalidation rule: ${rule.id} - ${rule.description}`);
      } catch (error) {
        console.error('Failed to add invalidation rule:', error);
        throw error;
      }
    },

    async updateRule(id: string, updates: Partial<AdvancedPatternRule>): Promise<void> {
      try {
        const rules = await this.listRules();
        const ruleIndex = rules.findIndex(r => r.id === id);
        
        if (ruleIndex === -1) {
          throw new Error(`Rule with ID ${id} not found`);
        }
        
        rules[ruleIndex] = { ...rules[ruleIndex], ...updates };
        
        await cachingService.set(rulesKey, rules, 86400 * 7);
      } catch (error) {
        console.error('Failed to update invalidation rule:', error);
        throw error;
      }
    },

    async removeRule(id: string): Promise<void> {
      try {
        const rules = await this.listRules();
        const filteredRules = rules.filter(r => r.id !== id);
        
        if (filteredRules.length === rules.length) {
          throw new Error(`Rule with ID ${id} not found`);
        }
        
        await cachingService.set(rulesKey, filteredRules, 86400 * 7);
      } catch (error) {
        console.error('Failed to remove invalidation rule:', error);
        throw error;
      }
    },

    async getRule(id: string): Promise<AdvancedPatternRule | null> {
      try {
        const rules = await this.listRules();
        return rules.find(r => r.id === id) || null;
      } catch (error) {
        console.error('Failed to get invalidation rule:', error);
        return null;
      }
    },

    async listRules(filters?: { enabled?: boolean; priority?: string }): Promise<AdvancedPatternRule[]> {
      try {
        const rules = await cachingService.get<AdvancedPatternRule[]>(rulesKey) || [];
        
        if (!filters) return rules;
        
        return rules.filter(rule => {
          if (filters.enabled !== undefined && rule.enabled !== filters.enabled) {
            return false;
          }
          if (filters.priority && rule.priority !== filters.priority) {
            return false;
          }
          return true;
        });
      } catch (error) {
        console.error('Failed to list invalidation rules:', error);
        return [];
      }
    },

    async invalidateByPattern(
      pattern: string, 
      options: InvalidationOptions = {}
    ): Promise<InvalidationResult> {
      const startTime = Date.now();
      
      try {
        const {
          immediate = true,
          priority = 'medium',
          dryRun = false,
          trackPerformance = true,
          maxItems = 1000,
          timeout = 30000,
        } = options;
        
        if (dryRun) {
          return await this.performDryRun(pattern, maxItems);
        }
        
        // Get keys matching pattern
        const kv = env.CACHE_KV;
        const list = await kv.list();
        const regex = this.patternToRegex(pattern);
        
        let keysToDelete = list.keys
          .filter(item => regex.test(item.name))
          .map(item => item.name);
        
        // Apply maxItems limit
        if (keysToDelete.length > maxItems) {
          keysToDelete = keysToDelete.slice(0, maxItems);
        }
        
        // Perform invalidation with timeout
        const invalidationPromise = this.performBatchDeletion(keysToDelete, priority);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Invalidation timeout')), timeout)
        );
        
        const deletedCount = await Promise.race([invalidationPromise, timeoutPromise]);
        const duration = Date.now() - startTime;
        
        const result: InvalidationResult = {
          success: true,
          itemsInvalidated: deletedCount,
          duration,
          errors: [],
          pattern,
        };
        
        // Track metrics
        if (trackPerformance) {
          await this.recordInvalidationMetrics(pattern, result);
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const result: InvalidationResult = {
          success: false,
          itemsInvalidated: 0,
          duration,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          pattern,
        };
        
        return result;
      }
    },

    async invalidateByRuleId(
      ruleId: string, 
      context: InvalidationContext = {}
    ): Promise<InvalidationResult> {
      try {
        const rule = await this.getRule(ruleId);
        
        if (!rule) {
          throw new Error(`Rule with ID ${ruleId} not found`);
        }
        
        if (!rule.enabled) {
          throw new Error(`Rule ${ruleId} is disabled`);
        }
        
        // Update rule trigger count
        rule.triggerCount++;
        rule.lastTriggered = new Date().toISOString();
        await this.updateRule(ruleId, { triggerCount: rule.triggerCount, lastTriggered: rule.lastTriggered });
        
        // Determine invalidation options from rule and context
        const options: InvalidationOptions = {
          immediate: rule.invalidationStrategy?.immediate ?? true,
          priority: context.priority || rule.priority,
          dryRun: context.dryRun || false,
          trackPerformance: rule.monitoring?.trackPerformance ?? true,
        };
        
        return await this.invalidateByPattern(rule.pattern, options);
      } catch (error) {
        console.error('Failed to invalidate by rule ID:', error);
        throw error;
      }
    },

    async invalidateMultiplePatterns(
      patterns: string[], 
      options: BatchInvalidationOptions = {}
    ): Promise<BatchInvalidationResult> {
      const jobId = await this.createBatchJob(patterns, options.priority);
      
      try {
        await this.executeBatchJob(jobId);
        const job = await this.getBatchJob(jobId);
        
        if (!job) {
          throw new Error('Batch job not found after execution');
        }
        
        return {
          jobId,
          totalPatterns: patterns.length,
          processedPatterns: job.itemsProcessed,
          totalItemsInvalidated: job.itemsTotal,
          totalDuration: job.completedAt ? 
            new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime() : 0,
          results: [], // Would be populated from job details
          errors: job.errors,
        };
      } catch (error) {
        console.error('Failed to execute batch invalidation:', error);
        throw error;
      }
    },

    async createBatchJob(
      patterns: string[], 
      priority: 'critical' | 'high' | 'medium' | 'low' = 'medium'
    ): Promise<string> {
      try {
        const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const job: BatchInvalidationJob = {
          id: jobId,
          patterns,
          status: 'pending',
          createdAt: new Date().toISOString(),
          itemsProcessed: 0,
          itemsTotal: 0,
          errors: [],
          priority,
        };
        
        await cachingService.set(`${batchJobsKey}:${jobId}`, job, 86400); // 24 hours
        
        return jobId;
      } catch (error) {
        console.error('Failed to create batch job:', error);
        throw error;
      }
    },

    async getBatchJob(jobId: string): Promise<BatchInvalidationJob | null> {
      try {
        return await cachingService.get<BatchInvalidationJob>(`${batchJobsKey}:${jobId}`);
      } catch (error) {
        console.error('Failed to get batch job:', error);
        return null;
      }
    },

    async executeBatchJob(jobId: string): Promise<void> {
      try {
        const job = await this.getBatchJob(jobId);
        
        if (!job) {
          throw new Error('Batch job not found');
        }
        
        if (job.status !== 'pending') {
          throw new Error(`Job ${jobId} is not in pending status`);
        }
        
        // Update job status
        job.status = 'running';
        job.startedAt = new Date().toISOString();
        await cachingService.set(`${batchJobsKey}:${jobId}`, job, 86400);
        
        // Process patterns in batches
        const batchSize = 5;
        let totalInvalidated = 0;
        
        for (let i = 0; i < job.patterns.length; i += batchSize) {
          const batch = job.patterns.slice(i, i + batchSize);
          
          const results = await Promise.allSettled(
            batch.map(pattern => this.invalidateByPattern(pattern, { priority: job.priority }))
          );
          
          results.forEach((result, index) => {
            job.itemsProcessed++;
            
            if (result.status === 'fulfilled') {
              totalInvalidated += result.value.itemsInvalidated;
            } else {
              job.errors.push(`Pattern ${batch[index]}: ${result.reason}`);
            }
          });
          
          // Update job progress
          job.itemsTotal = totalInvalidated;
          await cachingService.set(`${batchJobsKey}:${jobId}`, job, 86400);
        }
        
        // Complete job
        job.status = job.errors.length > 0 ? 'failed' : 'completed';
        job.completedAt = new Date().toISOString();
        job.itemsTotal = totalInvalidated;
        
        await cachingService.set(`${batchJobsKey}:${jobId}`, job, 86400);
      } catch (error) {
        console.error('Failed to execute batch job:', error);
        
        // Mark job as failed
        const job = await this.getBatchJob(jobId);
        if (job) {
          job.status = 'failed';
          job.errors.push(error instanceof Error ? error.message : 'Unknown error');
          await cachingService.set(`${batchJobsKey}:${jobId}`, job, 86400);
        }
        
        throw error;
      }
    },

    async invalidateByEvent(event: ExtendedInvalidationEvent): Promise<void> {
      try {
        const rules = await this.listRules({ enabled: true });
        const applicableRules = rules.filter(rule => this.eventMatchesRule(event, rule));
        
        // Sort by priority and execute
        applicableRules.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
        
        for (const rule of applicableRules) {
          try {
            await this.invalidateByRuleId(rule.id, {
              userId: event.userId,
              priority: rule.priority,
              reason: `Event: ${event.type} - ${event.action}`,
            });
          } catch (error) {
            console.error(`Failed to execute rule ${rule.id} for event:`, error);
          }
        }
      } catch (error) {
        console.error('Failed to invalidate by event:', error);
      }
    },

    async registerEventTrigger(event: string, rules: string[]): Promise<void> {
      try {
        const eventTriggersKey = 'event_triggers';
        const triggers = await cachingService.get<Record<string, string[]>>(eventTriggersKey) || {};
        
        triggers[event] = rules;
        
        await cachingService.set(eventTriggersKey, triggers, 86400 * 7);
      } catch (error) {
        console.error('Failed to register event trigger:', error);
        throw error;
      }
    },

    async getMetrics(timeRange?: { start: Date; end: Date }): Promise<InvalidationMetrics> {
      try {
        const metrics = await cachingService.get<InvalidationMetrics>(metricsKey) || this.getDefaultMetrics();
        
        // Filter by time range if provided
        if (timeRange) {
          metrics.recentInvalidations = metrics.recentInvalidations.filter(inv => {
            const timestamp = new Date(inv.timestamp);
            return timestamp >= timeRange.start && timestamp <= timeRange.end;
          });
        }
        
        return metrics;
      } catch (error) {
        console.error('Failed to get invalidation metrics:', error);
        return this.getDefaultMetrics();
      }
    },

    async getPatternUsage(pattern: string): Promise<PatternUsageStats> {
      try {
        const metrics = await this.getMetrics();
        const patternPerf = metrics.patternPerformance[pattern];
        
        if (!patternPerf) {
          return {
            pattern,
            totalCalls: 0,
            averageItemsInvalidated: 0,
            averageDuration: 0,
            successRate: 0,
            peakUsageTimes: [],
          };
        }
        
        // Find peak usage times from recent invalidations
        const patternInvalidations = metrics.recentInvalidations
          .filter(inv => inv.pattern === pattern)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        const lastUsed = patternInvalidations[0]?.timestamp;
        const peakUsageTimes = this.findPeakUsageTimes(patternInvalidations);
        
        return {
          pattern,
          totalCalls: patternPerf.calls,
          averageItemsInvalidated: patternInvalidations.reduce((sum, inv) => sum + inv.itemsInvalidated, 0) / patternInvalidations.length || 0,
          averageDuration: patternPerf.averageTime,
          successRate: patternPerf.successRate,
          lastUsed,
          peakUsageTimes,
        };
      } catch (error) {
        console.error('Failed to get pattern usage:', error);
        throw error;
      }
    },

    async testPattern(pattern: string, testKeys: string[]): Promise<{ matches: string[]; nonMatches: string[] }> {
      try {
        const regex = this.patternToRegex(pattern);
        
        const matches: string[] = [];
        const nonMatches: string[] = [];
        
        testKeys.forEach(key => {
          if (regex.test(key)) {
            matches.push(key);
          } else {
            nonMatches.push(key);
          }
        });
        
        return { matches, nonMatches };
      } catch (error) {
        console.error('Failed to test pattern:', error);
        return { matches: [], nonMatches: testKeys };
      }
    },

    async optimizePattern(pattern: string): Promise<{ optimized: string; performance: number }> {
      try {
        // Simple optimization: remove redundant wildcards and optimize common patterns
        let optimized = pattern
          .replace(/\*+/g, '*') // Replace multiple * with single *
          .replace(/\*\?\*/g, '*') // Replace *?* with *
          .replace(/^\*/, '') // Remove leading * if it covers everything
          .replace(/\*$/, '*'); // Ensure trailing * is preserved
        
        // Calculate performance score (higher is better)
        const performance = this.calculatePatternPerformance(optimized);
        
        return { optimized, performance };
      } catch (error) {
        console.error('Failed to optimize pattern:', error);
        return { optimized: pattern, performance: 0 };
      }
    },

    async onContentUpdate(contentId: string, contentType: string, userId: string): Promise<void> {
      const event: ExtendedInvalidationEvent = {
        type: 'content_update',
        contentId,
        contentType,
        userId,
        action: 'update',
        timestamp: new Date().toISOString(),
      };
      
      await this.invalidateByEvent(event);
    },

    async onUserAction(userId: string, action: string, targetId?: string): Promise<void> {
      const event: ExtendedInvalidationEvent = {
        type: 'user_action',
        userId,
        action,
        contentId: targetId,
        timestamp: new Date().toISOString(),
      };
      
      await this.invalidateByEvent(event);
    },

    // Helper methods
    validateRule(rule: AdvancedPatternRule): boolean {
      if (!rule.id || !rule.pattern || !rule.description) {
        return false;
      }
      
      try {
        this.patternToRegex(rule.pattern);
        return true;
      } catch {
        return false;
      }
    },

    patternToRegex(pattern: string): RegExp {
      const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\{([^}]+)\}/g, '($1)');
      
      return new RegExp(`^${escaped}$`);
    },

    async performDryRun(pattern: string, maxItems: number): Promise<InvalidationResult> {
      const startTime = Date.now();
      
      try {
        const kv = env.CACHE_KV;
        const list = await kv.list();
        const regex = this.patternToRegex(pattern);
        
        const matches = list.keys
          .filter(item => regex.test(item.name))
          .slice(0, maxItems);
        
        return {
          success: true,
          itemsInvalidated: matches.length,
          duration: Date.now() - startTime,
          errors: [],
          pattern,
          dryRun: true,
        };
      } catch (error) {
        return {
          success: false,
          itemsInvalidated: 0,
          duration: Date.now() - startTime,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          pattern,
          dryRun: true,
        };
      }
    },

    async performBatchDeletion(keys: string[], priority: string): Promise<number> {
      const batchSize = this.getBatchSizeForPriority(priority);
      let deletedCount = 0;
      
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(key => env.CACHE_KV.delete(key))
        );
        
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            deletedCount++;
          }
        });
      }
      
      return deletedCount;
    },

    getBatchSizeForPriority(priority: string): number {
      switch (priority) {
        case 'critical': return 50;
        case 'high': return 30;
        case 'medium': return 20;
        case 'low': return 10;
        default: return 20;
      }
    },

    getPriorityWeight(priority: string): number {
      switch (priority) {
        case 'critical': return 4;
        case 'high': return 3;
        case 'medium': return 2;
        case 'low': return 1;
        default: return 2;
      }
    },

    eventMatchesRule(event: ExtendedInvalidationEvent, rule: AdvancedPatternRule): boolean {
      if (!rule.conditions) return true;
      
      const { conditions } = rule;
      
      // Check user actions
      if (conditions.userAction && event.action) {
        if (!conditions.userAction.includes(event.action)) {
          return false;
        }
      }
      
      // Check content types
      if (conditions.contentType && event.contentType) {
        if (!conditions.contentType.includes(event.contentType)) {
          return false;
        }
      }
      
      // Check user roles
      if (conditions.userRoles && event.userRole) {
        if (!conditions.userRoles.includes(event.userRole)) {
          return false;
        }
      }
      
      // Check geographic restrictions
      if (conditions.geographic && event.geographic) {
        if (!conditions.geographic.includes(event.geographic)) {
          return false;
        }
      }
      
      // Check device type
      if (conditions.deviceType && event.deviceType) {
        if (!conditions.deviceType.includes(event.deviceType)) {
          return false;
        }
      }
      
      return true;
    },

    async recordInvalidationMetrics(pattern: string, result: InvalidationResult): Promise<void> {
      try {
        const metrics = await this.getMetrics();
        
        metrics.totalInvalidations++;
        if (result.success) {
          metrics.successfulInvalidations++;
        } else {
          metrics.failedInvalidations++;
        }
        
        // Update pattern performance
        if (!metrics.patternPerformance[pattern]) {
          metrics.patternPerformance[pattern] = {
            calls: 0,
            totalTime: 0,
            averageTime: 0,
            successRate: 0,
          };
        }
        
        const patternPerf = metrics.patternPerformance[pattern];
        patternPerf.calls++;
        patternPerf.totalTime += result.duration;
        patternPerf.averageTime = patternPerf.totalTime / patternPerf.calls;
        patternPerf.successRate = patternPerf.successRate === 0 ? 
          (result.success ? 100 : 0) : 
          ((patternPerf.successRate * (patternPerf.calls - 1)) + (result.success ? 100 : 0)) / patternPerf.calls;
        
        // Add to recent invalidations
        metrics.recentInvalidations.unshift({
          timestamp: new Date().toISOString(),
          pattern,
          itemsInvalidated: result.itemsInvalidated,
          duration: result.duration,
          success: result.success,
        });
        
        // Keep only last 100 recent invalidations
        metrics.recentInvalidations = metrics.recentInvalidations.slice(0, 100);
        
        // Update average invalidation time
        metrics.averageInvalidationTime = (metrics.averageInvalidationTime * (metrics.totalInvalidations - 1) + result.duration) / metrics.totalInvalidations;
        
        await cachingService.set(metricsKey, metrics, 86400 * 7);
      } catch (error) {
        console.error('Failed to record invalidation metrics:', error);
      }
    },

    getDefaultMetrics(): InvalidationMetrics {
      return {
        totalInvalidations: 0,
        successfulInvalidations: 0,
        failedInvalidations: 0,
        averageInvalidationTime: 0,
        patternPerformance: {},
        recentInvalidations: [],
      };
    },

    findPeakUsageTimes(invalidations: any[]): string[] {
      // Group by hour and find peak usage times
      const hourlyUsage: Record<string, number> = {};
      
      invalidations.forEach(inv => {
        const hour = new Date(inv.timestamp).getHours();
        const key = `${hour}:00`;
        hourlyUsage[key] = (hourlyUsage[key] || 0) + 1;
      });
      
      // Find top 3 hours
      return Object.entries(hourlyUsage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => hour);
    },

    calculatePatternPerformance(pattern: string): number {
      // Simple performance scoring based on pattern complexity
      let score = 100;
      
      // Penalize complex patterns
      const wildcards = (pattern.match(/\*/g) || []).length;
      const optionals = (pattern.match(/\?/g) || []).length;
      const alternatives = (pattern.match(/\{[^}]+\}/g) || []).length;
      
      score -= wildcards * 5;
      score -= optionals * 3;
      score -= alternatives * 10;
      
      // Bonus for specific patterns
      if (!pattern.includes('*')) score += 20;
      if (pattern.length < 20) score += 10;
      
      return Math.max(0, score);
    },
  };
}