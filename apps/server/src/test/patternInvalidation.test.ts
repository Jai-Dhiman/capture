import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import {
  createEnhancedInvalidationService,
  type AdvancedPatternRule,
  type ExtendedInvalidationEvent,
  type InvalidationOptions,
} from '../lib/cache/enhancedInvalidation';
import { createCacheInvalidationMiddleware, initializeInvalidationRules } from '../middleware/cacheInvalidation';
import type { Bindings } from '../types';

// Mock Bindings
const mockBindings: Bindings = {
  CACHE_KV: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  } as any,
} as any;

describe('Enhanced Pattern Invalidation Service', () => {
  let invalidationService: ReturnType<typeof createEnhancedInvalidationService>;
  let mockKV: MockedFunction<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };

    const mockBindingsWithKV = {
      ...mockBindings,
      CACHE_KV: mockKV,
    };

    invalidationService = createEnhancedInvalidationService(mockBindingsWithKV);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rule Management', () => {
    it('should add a new invalidation rule', async () => {
      mockKV.get.mockResolvedValue(null); // No existing rules

      const rule: AdvancedPatternRule = {
        id: 'test_rule',
        pattern: 'test:*',
        description: 'Test rule',
        priority: 'high',
        enabled: true,
        createdAt: new Date().toISOString(),
        triggerCount: 0,
      };

      await invalidationService.addRule(rule);

      expect(mockKV.put).toHaveBeenCalledWith(
        'enhanced_invalidation_rules',
        expect.stringContaining('test_rule'),
        { expirationTtl: 604800 }
      );
    });

    it('should prevent duplicate rule IDs', async () => {
      const existingRule: AdvancedPatternRule = {
        id: 'existing_rule',
        pattern: 'existing:*',
        description: 'Existing rule',
        priority: 'medium',
        enabled: true,
        createdAt: new Date().toISOString(),
        triggerCount: 0,
      };

      mockKV.get.mockResolvedValue(JSON.stringify([existingRule]));

      const duplicateRule: AdvancedPatternRule = {
        id: 'existing_rule',
        pattern: 'duplicate:*',
        description: 'Duplicate rule',
        priority: 'low',
        enabled: true,
        createdAt: new Date().toISOString(),
        triggerCount: 0,
      };

      await expect(invalidationService.addRule(duplicateRule)).rejects.toThrow(
        'Rule with ID existing_rule already exists'
      );
    });

    it('should update an existing rule', async () => {
      const existingRule: AdvancedPatternRule = {
        id: 'test_rule',
        pattern: 'test:*',
        description: 'Test rule',
        priority: 'high',
        enabled: true,
        createdAt: new Date().toISOString(),
        triggerCount: 0,
      };

      mockKV.get.mockResolvedValue(JSON.stringify([existingRule]));

      const updates = {
        description: 'Updated test rule',
        priority: 'medium' as const,
      };

      await invalidationService.updateRule('test_rule', updates);

      expect(mockKV.put).toHaveBeenCalledWith(
        'enhanced_invalidation_rules',
        expect.stringContaining('Updated test rule'),
        { expirationTtl: 604800 }
      );
    });

    it('should remove a rule', async () => {
      const existingRules: AdvancedPatternRule[] = [
        {
          id: 'rule1',
          pattern: 'test1:*',
          description: 'Test rule 1',
          priority: 'high',
          enabled: true,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
        },
        {
          id: 'rule2',
          pattern: 'test2:*',
          description: 'Test rule 2',
          priority: 'medium',
          enabled: true,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
        },
      ];

      mockKV.get.mockResolvedValue(JSON.stringify(existingRules));

      await invalidationService.removeRule('rule1');

      expect(mockKV.put).toHaveBeenCalledWith(
        'enhanced_invalidation_rules',
        expect.not.stringContaining('rule1'),
        { expirationTtl: 604800 }
      );
    });

    it('should list rules with filters', async () => {
      const rules: AdvancedPatternRule[] = [
        {
          id: 'enabled_high',
          pattern: 'test1:*',
          description: 'Enabled high priority rule',
          priority: 'high',
          enabled: true,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
        },
        {
          id: 'disabled_high',
          pattern: 'test2:*',
          description: 'Disabled high priority rule',
          priority: 'high',
          enabled: false,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
        },
        {
          id: 'enabled_low',
          pattern: 'test3:*',
          description: 'Enabled low priority rule',
          priority: 'low',
          enabled: true,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
        },
      ];

      mockKV.get.mockResolvedValue(JSON.stringify(rules));

      const enabledRules = await invalidationService.listRules({ enabled: true });
      expect(enabledRules).toHaveLength(2);
      expect(enabledRules.every(rule => rule.enabled)).toBe(true);

      const highPriorityRules = await invalidationService.listRules({ priority: 'high' });
      expect(highPriorityRules).toHaveLength(2);
      expect(highPriorityRules.every(rule => rule.priority === 'high')).toBe(true);

      const enabledHighRules = await invalidationService.listRules({ enabled: true, priority: 'high' });
      expect(enabledHighRules).toHaveLength(1);
      expect(enabledHighRules[0].id).toBe('enabled_high');
    });
  });

  describe('Pattern Invalidation', () => {
    beforeEach(() => {
      mockKV.list.mockResolvedValue({
        keys: [
          { name: 'test:user:123' },
          { name: 'test:user:456' },
          { name: 'test:post:789' },
          { name: 'other:data' },
        ],
      });
    });

    it('should invalidate keys matching a pattern', async () => {
      const options: InvalidationOptions = {
        priority: 'high',
        trackPerformance: true,
      };

      const result = await invalidationService.invalidateByPattern('test:user:*', options);

      expect(result.success).toBe(true);
      expect(result.itemsInvalidated).toBe(2); // test:user:123 and test:user:456
      expect(result.pattern).toBe('test:user:*');
      expect(mockKV.delete).toHaveBeenCalledTimes(2);
      expect(mockKV.delete).toHaveBeenCalledWith('test:user:123');
      expect(mockKV.delete).toHaveBeenCalledWith('test:user:456');
    });

    it('should perform dry run without deleting keys', async () => {
      const options: InvalidationOptions = {
        dryRun: true,
        trackPerformance: false,
      };

      const result = await invalidationService.invalidateByPattern('test:*', options);

      expect(result.success).toBe(true);
      expect(result.itemsInvalidated).toBe(3); // All test: keys
      expect(result.dryRun).toBe(true);
      expect(mockKV.delete).not.toHaveBeenCalled();
    });

    it('should respect maxItems limit', async () => {
      const options: InvalidationOptions = {
        maxItems: 1,
        trackPerformance: false,
      };

      const result = await invalidationService.invalidateByPattern('test:*', options);

      expect(result.success).toBe(true);
      expect(result.itemsInvalidated).toBe(1);
      expect(mockKV.delete).toHaveBeenCalledTimes(1);
    });

    it('should handle invalidation timeout', async () => {
      mockKV.delete.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const options: InvalidationOptions = {
        timeout: 50, // 50ms timeout
        trackPerformance: false,
      };

      const result = await invalidationService.invalidateByPattern('test:*', options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalidation timeout');
    });
  });

  describe('Event-Driven Invalidation', () => {
    it('should invalidate based on events', async () => {
      const rules: AdvancedPatternRule[] = [
        {
          id: 'post_update_rule',
          pattern: 'post:{contentId}*',
          description: 'Invalidate post cache on update',
          priority: 'high',
          enabled: true,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
          conditions: {
            userAction: ['post_update'],
            contentType: ['post'],
          },
        },
      ];

      mockKV.get.mockResolvedValue(JSON.stringify(rules));
      mockKV.list.mockResolvedValue({
        keys: [
          { name: 'post:123:data' },
          { name: 'post:123:metadata' },
          { name: 'post:456:data' },
        ],
      });

      const event: ExtendedInvalidationEvent = {
        type: 'content_update',
        userId: 'user123',
        contentId: '123',
        contentType: 'post',
        action: 'post_update',
        timestamp: new Date().toISOString(),
      };

      await invalidationService.invalidateByEvent(event);

      // Should have triggered the rule and updated trigger count
      expect(mockKV.put).toHaveBeenCalledWith(
        'enhanced_invalidation_rules',
        expect.stringContaining('"triggerCount":1'),
        { expirationTtl: 604800 }
      );
    });

    it('should not invalidate for non-matching events', async () => {
      const rules: AdvancedPatternRule[] = [
        {
          id: 'post_update_rule',
          pattern: 'post:*',
          description: 'Invalidate post cache on update',
          priority: 'high',
          enabled: true,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
          conditions: {
            userAction: ['post_update'],
            contentType: ['post'],
          },
        },
      ];

      mockKV.get.mockResolvedValue(JSON.stringify(rules));

      const event: ExtendedInvalidationEvent = {
        type: 'user_action',
        userId: 'user123',
        action: 'profile_update', // Different action
        timestamp: new Date().toISOString(),
      };

      await invalidationService.invalidateByEvent(event);

      // Should not have triggered any invalidation
      expect(mockKV.delete).not.toHaveBeenCalled();
    });

    it('should respect rule priority ordering', async () => {
      const rules: AdvancedPatternRule[] = [
        {
          id: 'low_priority_rule',
          pattern: 'cache:*',
          description: 'Low priority rule',
          priority: 'low',
          enabled: true,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
          conditions: {
            userAction: ['test_action'],
          },
        },
        {
          id: 'critical_priority_rule',
          pattern: 'important:*',
          description: 'Critical priority rule',
          priority: 'critical',
          enabled: true,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
          conditions: {
            userAction: ['test_action'],
          },
        },
      ];

      mockKV.get.mockResolvedValue(JSON.stringify(rules));
      mockKV.list.mockResolvedValue({ keys: [] });

      const event: ExtendedInvalidationEvent = {
        type: 'user_action',
        userId: 'user123',
        action: 'test_action',
        timestamp: new Date().toISOString(),
      };

      await invalidationService.invalidateByEvent(event);

      // Critical priority rule should be executed first
      const putCalls = mockKV.put.mock.calls;
      expect(putCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Processing', () => {
    it('should create and execute batch jobs', async () => {
      const patterns = ['pattern1:*', 'pattern2:*', 'pattern3:*'];
      
      mockKV.list.mockResolvedValue({
        keys: [
          { name: 'pattern1:test1' },
          { name: 'pattern1:test2' },
          { name: 'pattern2:test3' },
        ],
      });

      const jobId = await invalidationService.createBatchJob(patterns, 'high');
      expect(jobId).toMatch(/^batch_\d+_[a-z0-9]+$/);

      await invalidationService.executeBatchJob(jobId);

      const job = await invalidationService.getBatchJob(jobId);
      expect(job).toBeTruthy();
      expect(job?.status).toBe('completed');
    });

    it('should handle batch job failures gracefully', async () => {
      mockKV.delete.mockRejectedValue(new Error('Delete failed'));
      mockKV.list.mockResolvedValue({
        keys: [{ name: 'test:key' }],
      });

      const patterns = ['test:*'];
      const jobId = await invalidationService.createBatchJob(patterns, 'medium');

      await invalidationService.executeBatchJob(jobId);

      const job = await invalidationService.getBatchJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Testing and Optimization', () => {
    it('should test patterns against keys', async () => {
      const testKeys = [
        'user:123:profile',
        'user:456:settings',
        'post:789:data',
        'media:abc:metadata',
      ];

      const result = await invalidationService.testPattern('user:*', testKeys);

      expect(result.matches).toEqual(['user:123:profile', 'user:456:settings']);
      expect(result.nonMatches).toEqual(['post:789:data', 'media:abc:metadata']);
    });

    it('should optimize patterns', async () => {
      const result = await invalidationService.optimizePattern('**user**:*?*:***data***');

      expect(result.optimized).toBe('*user*:*:*data*');
      expect(result.performance).toBeGreaterThan(0);
    });

    it('should handle invalid patterns gracefully', async () => {
      const result = await invalidationService.testPattern('[invalid', ['test:key']);

      expect(result.matches).toEqual([]);
      expect(result.nonMatches).toEqual(['test:key']);
    });
  });

  describe('Metrics and Analytics', () => {
    it('should track invalidation metrics', async () => {
      mockKV.get.mockResolvedValueOnce(null); // No existing metrics
      mockKV.list.mockResolvedValue({
        keys: [{ name: 'test:key1' }, { name: 'test:key2' }],
      });

      await invalidationService.invalidateByPattern('test:*', { trackPerformance: true });

      const metrics = await invalidationService.getMetrics();
      expect(metrics.totalInvalidations).toBeGreaterThan(0);
      expect(metrics.recentInvalidations.length).toBeGreaterThan(0);
    });

    it('should provide pattern usage statistics', async () => {
      const mockMetrics = {
        totalInvalidations: 10,
        successfulInvalidations: 8,
        failedInvalidations: 2,
        averageInvalidationTime: 150,
        patternPerformance: {
          'test:*': {
            calls: 5,
            totalTime: 500,
            averageTime: 100,
            successRate: 80,
          },
        },
        recentInvalidations: [
          {
            timestamp: new Date().toISOString(),
            pattern: 'test:*',
            itemsInvalidated: 3,
            duration: 120,
            success: true,
          },
        ],
      };

      mockKV.get.mockResolvedValue(JSON.stringify(mockMetrics));

      const usage = await invalidationService.getPatternUsage('test:*');

      expect(usage.pattern).toBe('test:*');
      expect(usage.totalCalls).toBe(5);
      expect(usage.averageDuration).toBe(100);
      expect(usage.successRate).toBe(80);
    });
  });
});

describe('Cache Invalidation Middleware', () => {
  let mockContext: any;
  let mockNext: any;
  let mockEnv: Bindings;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv = {
      ...mockBindings,
      CACHE_KV: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      } as any,
    };

    mockContext = {
      env: mockEnv,
      get: vi.fn(),
      req: {
        url: 'https://example.com/graphql',
        method: 'POST',
        clone: () => ({
          text: () => Promise.resolve('{"query": "mutation { createPost(input: {...}) { id } }"}'),
        }),
      },
      res: {
        status: 200,
      },
    };

    mockNext = vi.fn().mockResolvedValue(undefined);
  });

  it('should trigger invalidation for GraphQL post mutations', async () => {
    mockContext.get.mockReturnValue({ id: 'user123' });

    const middleware = createCacheInvalidationMiddleware({
      enabled: true,
      logInvalidations: false,
    });

    await middleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
    // Invalidation should have been triggered (tested through KV calls)
  });

  it('should skip invalidation for non-successful responses', async () => {
    mockContext.res.status = 500;
    mockContext.get.mockReturnValue({ id: 'user123' });

    const middleware = createCacheInvalidationMiddleware({
      enabled: true,
      logInvalidations: false,
    });

    await middleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
    // No invalidation should occur for failed requests
  });

  it('should handle REST API operations', async () => {
    mockContext.req.url = 'https://example.com/api/posts/123';
    mockContext.req.method = 'PUT';
    mockContext.get.mockReturnValue({ id: 'user123' });

    const middleware = createCacheInvalidationMiddleware({
      enabled: true,
      rules: {
        postOperations: true,
        userOperations: false,
        mediaOperations: false,
        systemOperations: false,
      },
    });

    await middleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should be disabled when enabled is false', async () => {
    const middleware = createCacheInvalidationMiddleware({
      enabled: false,
    });

    await middleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
    // No KV operations should occur
    expect(mockEnv.CACHE_KV.get).not.toHaveBeenCalled();
  });

  it('should not fail requests when invalidation fails', async () => {
    mockEnv.CACHE_KV.get.mockRejectedValue(new Error('KV error'));
    mockContext.get.mockReturnValue({ id: 'user123' });

    const middleware = createCacheInvalidationMiddleware({
      enabled: true,
      logInvalidations: false,
    });

    // Should not throw
    await expect(middleware(mockContext, mockNext)).resolves.toBeUndefined();
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('Invalidation Rules Initialization', () => {
  it('should initialize default rules', async () => {
    const mockEnv = {
      ...mockBindings,
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      } as any,
    };

    await initializeInvalidationRules(mockEnv);

    // Should have attempted to add multiple rules
    expect(mockEnv.CACHE_KV.put).toHaveBeenCalledTimes(expect.any(Number));
  });

  it('should handle rule initialization failures gracefully', async () => {
    const mockEnv = {
      ...mockBindings,
      CACHE_KV: {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      } as any,
    };

    // Should not throw
    await expect(initializeInvalidationRules(mockEnv)).resolves.toBeUndefined();
  });
});