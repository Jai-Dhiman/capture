import type { Context, Next } from 'hono';
import type { Bindings, Variables } from '@/types';
import { createEnhancedInvalidationService } from '../lib/cache/enhancedInvalidation';
import { InvalidationTriggers } from '../lib/cache/patternInvalidation';

interface CacheInvalidationMiddlewareOptions {
  enabled?: boolean;
  trackPerformance?: boolean;
  logInvalidations?: boolean;
  rules?: {
    postOperations?: boolean;
    userOperations?: boolean;
    mediaOperations?: boolean;
    systemOperations?: boolean;
  };
}

export function createCacheInvalidationMiddleware(options: CacheInvalidationMiddlewareOptions = {}) {
  const {
    enabled = true,
    trackPerformance = true,
    logInvalidations = true,
    rules = {
      postOperations: true,
      userOperations: true,
      mediaOperations: true,
      systemOperations: true,
    },
  } = options;

  return async function cacheInvalidationMiddleware(
    c: Context<{ Bindings: Bindings; Variables: Variables }>,
    next: Next
  ) {
    if (!enabled) {
      return await next();
    }

    const invalidationService = createEnhancedInvalidationService(c.env);
    const user = c.get('user');
    const request = c.req;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Store original response
    await next();

    // Only process successful operations
    const status = c.res.status;
    if (status < 200 || status >= 300) {
      return;
    }

    try {
      // Determine what type of operation this was and trigger appropriate invalidations
      await processInvalidationTriggers({
        invalidationService,
        path,
        method,
        user,
        request,
        rules,
        trackPerformance,
        logInvalidations,
      });
    } catch (error) {
      // Don't fail the request if invalidation fails
      console.error('Cache invalidation middleware error:', error);
    }
  };
}

async function processInvalidationTriggers({
  invalidationService,
  path,
  method,
  user,
  request,
  rules,
  trackPerformance,
  logInvalidations,
}: {
  invalidationService: any;
  path: string;
  method: string;
  user: any;
  request: Request;
  rules: any;
  trackPerformance: boolean;
  logInvalidations: boolean;
}) {
  const userId = user?.id;
  const timestamp = new Date().toISOString();

  // GraphQL operations
  if (path.includes('/graphql') && method === 'POST') {
    const body = await request.clone().text();
    let operation;
    
    try {
      const graphqlRequest = JSON.parse(body);
      operation = graphqlRequest.query || graphqlRequest.operationName;
    } catch {
      return; // Invalid GraphQL request
    }

    if (rules.postOperations) {
      await handlePostOperations(invalidationService, operation, userId, timestamp, logInvalidations);
    }

    if (rules.userOperations) {
      await handleUserOperations(invalidationService, operation, userId, timestamp, logInvalidations);
    }

    if (rules.mediaOperations) {
      await handleMediaOperations(invalidationService, operation, userId, timestamp, logInvalidations);
    }

    return;
  }

  // REST API operations
  if (rules.postOperations) {
    await handleRESTPostOperations(invalidationService, path, method, userId, timestamp, logInvalidations);
  }

  if (rules.userOperations) {
    await handleRESTUserOperations(invalidationService, path, method, userId, timestamp, logInvalidations);
  }

  if (rules.mediaOperations) {
    await handleRESTMediaOperations(invalidationService, path, method, userId, timestamp, logInvalidations);
  }

  if (rules.systemOperations) {
    await handleSystemOperations(invalidationService, path, method, timestamp, logInvalidations);
  }
}

async function handlePostOperations(
  invalidationService: any,
  operation: string,
  userId: string | undefined,
  timestamp: string,
  logInvalidations: boolean
) {
  const postMutations = [
    'createPost',
    'updatePost',
    'deletePost',
    'publishPost',
    'unpublishPost',
    'likePost',
    'unlikePost',
    'savePost',
    'unsavePost',
    'sharePost',
  ];

  const postQueries = [
    'getPost',
    'getPosts',
    'getFeed',
    'getDiscoveryFeed',
    'getUserPosts',
    'getSavedPosts',
  ];

  if (postMutations.some(mutation => operation.includes(mutation))) {
    const events = [];

    if (operation.includes('createPost')) {
      events.push({
        type: 'content_update' as const,
        userId,
        action: 'post_create',
        contentType: 'post',
        timestamp,
      });
    }

    if (operation.includes('updatePost')) {
      events.push({
        type: 'content_update' as const,
        userId,
        action: 'post_update',
        contentType: 'post',
        timestamp,
      });
    }

    if (operation.includes('deletePost')) {
      events.push({
        type: 'content_update' as const,
        userId,
        action: 'post_delete',
        contentType: 'post',
        timestamp,
      });
    }

    if (operation.includes('likePost') || operation.includes('unlikePost')) {
      events.push({
        type: 'user_action' as const,
        userId,
        action: operation.includes('like') ? 'like' : 'unlike',
        contentType: 'post',
        timestamp,
      });
    }

    if (operation.includes('savePost') || operation.includes('unsavePost')) {
      events.push({
        type: 'user_action' as const,
        userId,
        action: operation.includes('save') ? 'save' : 'unsave',
        contentType: 'post',
        timestamp,
      });
    }

    // Execute invalidations for all events
    for (const event of events) {
      try {
        await invalidationService.invalidateByEvent(event);
        
        if (logInvalidations) {
          console.log(`Cache invalidation triggered: ${event.action} by user ${userId}`);
        }
      } catch (error) {
        console.error('Failed to invalidate cache for post operation:', error);
      }
    }
  }
}

async function handleUserOperations(
  invalidationService: any,
  operation: string,
  userId: string | undefined,
  timestamp: string,
  logInvalidations: boolean
) {
  const userMutations = [
    'updateProfile',
    'followUser',
    'unfollowUser',
    'blockUser',
    'unblockUser',
    'updateSettings',
    'updatePreferences',
  ];

  if (userMutations.some(mutation => operation.includes(mutation))) {
    const events = [];

    if (operation.includes('updateProfile')) {
      events.push({
        type: 'user_action' as const,
        userId,
        action: 'profile_update',
        timestamp,
      });
    }

    if (operation.includes('followUser') || operation.includes('unfollowUser')) {
      events.push({
        type: 'user_action' as const,
        userId,
        action: operation.includes('follow') ? 'follow' : 'unfollow',
        timestamp,
      });
    }

    if (operation.includes('blockUser') || operation.includes('unblockUser')) {
      events.push({
        type: 'user_action' as const,
        userId,
        action: operation.includes('block') ? 'block' : 'unblock',
        timestamp,
      });
    }

    if (operation.includes('updateSettings') || operation.includes('updatePreferences')) {
      events.push({
        type: 'user_action' as const,
        userId,
        action: 'settings_change',
        timestamp,
      });
    }

    // Execute invalidations
    for (const event of events) {
      try {
        await invalidationService.invalidateByEvent(event);
        
        if (logInvalidations) {
          console.log(`Cache invalidation triggered: ${event.action} by user ${userId}`);
        }
      } catch (error) {
        console.error('Failed to invalidate cache for user operation:', error);
      }
    }
  }
}

async function handleMediaOperations(
  invalidationService: any,
  operation: string,
  userId: string | undefined,
  timestamp: string,
  logInvalidations: boolean
) {
  const mediaMutations = [
    'uploadMedia',
    'updateMedia',
    'deleteMedia',
    'processMedia',
  ];

  if (mediaMutations.some(mutation => operation.includes(mutation))) {
    const events = [];

    if (operation.includes('uploadMedia')) {
      events.push({
        type: 'content_update' as const,
        userId,
        action: 'media_create',
        contentType: 'media',
        timestamp,
      });
    }

    if (operation.includes('updateMedia')) {
      events.push({
        type: 'content_update' as const,
        userId,
        action: 'media_update',
        contentType: 'media',
        timestamp,
      });
    }

    if (operation.includes('deleteMedia')) {
      events.push({
        type: 'content_update' as const,
        userId,
        action: 'media_delete',
        contentType: 'media',
        timestamp,
      });
    }

    // Execute invalidations
    for (const event of events) {
      try {
        await invalidationService.invalidateByEvent(event);
        
        if (logInvalidations) {
          console.log(`Cache invalidation triggered: ${event.action} by user ${userId}`);
        }
      } catch (error) {
        console.error('Failed to invalidate cache for media operation:', error);
      }
    }
  }
}

async function handleRESTPostOperations(
  invalidationService: any,
  path: string,
  method: string,
  userId: string | undefined,
  timestamp: string,
  logInvalidations: boolean
) {
  // Handle REST API post operations
  if (path.includes('/posts')) {
    let action = '';
    let contentType = 'post';

    switch (method) {
      case 'POST':
        action = 'post_create';
        break;
      case 'PUT':
      case 'PATCH':
        action = 'post_update';
        break;
      case 'DELETE':
        action = 'post_delete';
        break;
      default:
        return;
    }

    const event = {
      type: 'content_update' as const,
      userId,
      action,
      contentType,
      timestamp,
    };

    try {
      await invalidationService.invalidateByEvent(event);
      
      if (logInvalidations) {
        console.log(`Cache invalidation triggered: ${action} by user ${userId}`);
      }
    } catch (error) {
      console.error('Failed to invalidate cache for REST post operation:', error);
    }
  }
}

async function handleRESTUserOperations(
  invalidationService: any,
  path: string,
  method: string,
  userId: string | undefined,
  timestamp: string,
  logInvalidations: boolean
) {
  // Handle REST API user operations
  if (path.includes('/profile') || path.includes('/users')) {
    if (method === 'PUT' || method === 'PATCH') {
      const event = {
        type: 'user_action' as const,
        userId,
        action: 'profile_update',
        timestamp,
      };

      try {
        await invalidationService.invalidateByEvent(event);
        
        if (logInvalidations) {
          console.log(`Cache invalidation triggered: profile_update by user ${userId}`);
        }
      } catch (error) {
        console.error('Failed to invalidate cache for REST user operation:', error);
      }
    }
  }
}

async function handleRESTMediaOperations(
  invalidationService: any,
  path: string,
  method: string,
  userId: string | undefined,
  timestamp: string,
  logInvalidations: boolean
) {
  // Handle REST API media operations
  if (path.includes('/media')) {
    let action = '';

    switch (method) {
      case 'POST':
        action = 'media_create';
        break;
      case 'PUT':
      case 'PATCH':
        action = 'media_update';
        break;
      case 'DELETE':
        action = 'media_delete';
        break;
      default:
        return;
    }

    const event = {
      type: 'content_update' as const,
      userId,
      action,
      contentType: 'media',
      timestamp,
    };

    try {
      await invalidationService.invalidateByEvent(event);
      
      if (logInvalidations) {
        console.log(`Cache invalidation triggered: ${action} by user ${userId}`);
      }
    } catch (error) {
      console.error('Failed to invalidate cache for REST media operation:', error);
    }
  }
}

async function handleSystemOperations(
  invalidationService: any,
  path: string,
  method: string,
  timestamp: string,
  logInvalidations: boolean
) {
  // Handle system operations that should trigger cache invalidation
  if (path.includes('/admin') || path.includes('/system')) {
    const event = {
      type: 'system_event' as const,
      action: 'admin_operation',
      timestamp,
      metadata: {
        path,
        method,
      },
    };

    try {
      await invalidationService.invalidateByEvent(event);
      
      if (logInvalidations) {
        console.log(`Cache invalidation triggered: admin_operation at ${path}`);
      }
    } catch (error) {
      console.error('Failed to invalidate cache for system operation:', error);
    }
  }
}

// Enhanced invalidation rules for content workflows
export const ContentWorkflowInvalidationRules = {
  postRules: [
    {
      id: 'post_create_rule',
      pattern: 'feed:*',
      description: 'Invalidate all feeds when a post is created',
      priority: 'high' as const,
      enabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
      conditions: {
        userAction: ['post_create'],
        contentType: ['post'],
      },
      invalidationStrategy: {
        immediate: true,
        cascading: true,
      },
      monitoring: {
        trackPerformance: true,
        alertOnFailure: true,
        logDetails: true,
      },
    },
    {
      id: 'post_update_rule',
      pattern: 'post:{contentId}*',
      description: 'Invalidate specific post cache when updated',
      priority: 'high' as const,
      enabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
      conditions: {
        userAction: ['post_update'],
        contentType: ['post'],
      },
      invalidationStrategy: {
        immediate: true,
      },
      monitoring: {
        trackPerformance: true,
        alertOnFailure: true,
        logDetails: true,
      },
    },
    {
      id: 'post_interaction_rule',
      pattern: 'discovery_feed:*',
      description: 'Invalidate discovery feeds when users interact with posts',
      priority: 'medium' as const,
      enabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
      conditions: {
        userAction: ['like', 'unlike', 'save', 'unsave', 'comment'],
        contentType: ['post'],
      },
      invalidationStrategy: {
        immediate: false,
        delayed: 60, // 1 minute delay for batching
        batched: true,
      },
      monitoring: {
        trackPerformance: true,
        alertOnFailure: false,
        logDetails: false,
      },
    },
  ],

  userRules: [
    {
      id: 'profile_update_rule',
      pattern: '*{userId}*',
      description: 'Invalidate all user-related cache when profile is updated',
      priority: 'high' as const,
      enabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
      conditions: {
        userAction: ['profile_update'],
      },
      invalidationStrategy: {
        immediate: true,
        cascading: true,
      },
      monitoring: {
        trackPerformance: true,
        alertOnFailure: true,
        logDetails: true,
      },
    },
    {
      id: 'social_interaction_rule',
      pattern: 'feed:{userId}:*',
      description: 'Invalidate user feeds when social interactions occur',
      priority: 'medium' as const,
      enabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
      conditions: {
        userAction: ['follow', 'unfollow', 'block', 'unblock'],
      },
      invalidationStrategy: {
        immediate: true,
      },
      monitoring: {
        trackPerformance: true,
        alertOnFailure: false,
        logDetails: true,
      },
    },
  ],

  mediaRules: [
    {
      id: 'media_update_rule',
      pattern: 'media:{contentId}*',
      description: 'Invalidate media cache when media is updated',
      priority: 'medium' as const,
      enabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
      conditions: {
        userAction: ['media_update', 'media_delete'],
        contentType: ['media'],
      },
      invalidationStrategy: {
        immediate: true,
      },
      monitoring: {
        trackPerformance: true,
        alertOnFailure: true,
        logDetails: true,
      },
    },
  ],

  systemRules: [
    {
      id: 'admin_operation_rule',
      pattern: '*',
      description: 'Invalidate all cache for critical admin operations',
      priority: 'critical' as const,
      enabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
      conditions: {
        userAction: ['admin_operation'],
      },
      invalidationStrategy: {
        immediate: true,
        cascading: true,
      },
      monitoring: {
        trackPerformance: true,
        alertOnFailure: true,
        logDetails: true,
      },
    },
  ],
};

// Utility function to initialize invalidation rules
export async function initializeInvalidationRules(env: Bindings) {
  const invalidationService = createEnhancedInvalidationService(env);
  
  try {
    const allRules = [
      ...ContentWorkflowInvalidationRules.postRules,
      ...ContentWorkflowInvalidationRules.userRules,
      ...ContentWorkflowInvalidationRules.mediaRules,
      ...ContentWorkflowInvalidationRules.systemRules,
    ];

    for (const rule of allRules) {
      try {
        await invalidationService.addRule(rule);
        console.log(`Initialized invalidation rule: ${rule.id}`);
      } catch (error) {
        // Rule might already exist, which is fine
        console.log(`Invalidation rule ${rule.id} already exists or failed to add`);
      }
    }

    console.log('Cache invalidation rules initialized successfully');
  } catch (error) {
    console.error('Failed to initialize invalidation rules:', error);
  }
}