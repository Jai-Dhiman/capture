import type { Bindings } from '@/types';

export interface AccessPolicy {
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  conditions?: Record<string, any>;
}

export interface UserPermissions {
  userId: string;
  role: 'user' | 'admin' | 'moderator';
  permissions: string[];
}

export enum R2Actions {
  // Read operations
  READ = 'r2:read',
  LIST = 'r2:list',
  
  // Write operations
  WRITE = 'r2:write',
  DELETE = 'r2:delete',
  
  // Admin operations
  CONFIGURE = 'r2:configure',
  MANAGE_POLICIES = 'r2:manage_policies',
}

export class R2AccessController {
  private policies: AccessPolicy[] = [];
  
  constructor() {
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    // Default policies for user role
    this.policies = [
      // Users can read their own images
      {
        resource: 'images/*',
        action: R2Actions.READ,
        effect: 'allow',
        conditions: {
          userOwned: true,
        },
      },
      
      // Users can upload images
      {
        resource: 'images/*',
        action: R2Actions.WRITE,
        effect: 'allow',
        conditions: {
          userOwned: true,
          fileSizeLimit: 10 * 1024 * 1024, // 10MB
        },
      },
      
      // Users can delete their own images
      {
        resource: 'images/*',
        action: R2Actions.DELETE,
        effect: 'allow',
        conditions: {
          userOwned: true,
        },
      },
      
      // Admins have full access
      {
        resource: '*',
        action: '*',
        effect: 'allow',
        conditions: {
          role: 'admin',
        },
      },
      
      // Moderators can read all content
      {
        resource: 'images/*',
        action: R2Actions.READ,
        effect: 'allow',
        conditions: {
          role: 'moderator',
        },
      },
      
      // Deny access to system directories
      {
        resource: 'system/*',
        action: '*',
        effect: 'deny',
        conditions: {
          role: ['user', 'moderator'],
        },
      },
    ];
  }

  async checkPermission(
    userId: string,
    role: string,
    action: string,
    resource: string,
    context: Record<string, any> = {}
  ): Promise<boolean> {
    // Find applicable policies
    const applicablePolicies = this.policies.filter(policy => {
      return this.matchesResource(policy.resource, resource) &&
             this.matchesAction(policy.action, action);
    });

    // Check each policy
    for (const policy of applicablePolicies) {
      if (await this.evaluateConditions(policy.conditions, {
        userId,
        role,
        resource,
        ...context,
      })) {
        return policy.effect === 'allow';
      }
    }

    // Default deny
    return false;
  }

  private matchesResource(policyResource: string, actualResource: string): boolean {
    if (policyResource === '*') return true;
    
    // Handle wildcard patterns
    if (policyResource.endsWith('*')) {
      const prefix = policyResource.slice(0, -1);
      return actualResource.startsWith(prefix);
    }
    
    return policyResource === actualResource;
  }

  private matchesAction(policyAction: string, actualAction: string): boolean {
    if (policyAction === '*') return true;
    return policyAction === actualAction;
  }

  private async evaluateConditions(
    conditions: Record<string, any> | undefined,
    context: Record<string, any>
  ): Promise<boolean> {
    if (!conditions) return true;

    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'userOwned':
          if (value && !await this.isUserOwned(context.resource, context.userId)) {
            return false;
          }
          break;
          
        case 'role':
          if (Array.isArray(value)) {
            if (!value.includes(context.role)) return false;
          } else {
            if (context.role !== value) return false;
          }
          break;
          
        case 'fileSizeLimit':
          if (context.fileSize && context.fileSize > value) {
            return false;
          }
          break;
          
        default:
          // Unknown condition, be conservative
          return false;
      }
    }

    return true;
  }

  private async isUserOwned(resource: string, userId: string): Promise<boolean> {
    // Extract the image ID from the resource path
    const imageId = resource.split('/').pop();
    if (!imageId) return false;

    // Check if the image belongs to the user
    // This would typically query the database
    // For now, we'll assume the resource path contains the user ID
    return resource.includes(`/${userId}/`) || resource.startsWith(`images/${userId}_`);
  }

  addPolicy(policy: AccessPolicy): void {
    this.policies.push(policy);
  }

  removePolicy(resource: string, action: string): void {
    this.policies = this.policies.filter(
      policy => !(policy.resource === resource && policy.action === action)
    );
  }
}

export class R2AuthenticationMiddleware {
  private accessController: R2AccessController;

  constructor() {
    this.accessController = new R2AccessController();
  }

  async validateR2Access(
    userId: string,
    userRole: string,
    action: string,
    resource: string,
    context: Record<string, any> = {}
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const allowed = await this.accessController.checkPermission(
        userId,
        userRole,
        action,
        resource,
        context
      );

      if (!allowed) {
        return {
          allowed: false,
          reason: `Access denied: insufficient permissions for ${action} on ${resource}`,
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Access validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async validateUpload(
    userId: string,
    userRole: string,
    fileName: string,
    fileSize: number,
    contentType: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const resource = `images/${userId}_${fileName}`;
    
    return this.validateR2Access(
      userId,
      userRole,
      R2Actions.WRITE,
      resource,
      {
        fileSize,
        contentType,
        fileName,
      }
    );
  }

  async validateDownload(
    userId: string,
    userRole: string,
    resourceKey: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    return this.validateR2Access(
      userId,
      userRole,
      R2Actions.READ,
      resourceKey
    );
  }

  async validateDelete(
    userId: string,
    userRole: string,
    resourceKey: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    return this.validateR2Access(
      userId,
      userRole,
      R2Actions.DELETE,
      resourceKey
    );
  }
}

// Rate limiting for R2 operations
export class R2RateLimiter {
  private limits: Map<string, { count: number; resetTime: number }> = new Map();

  async checkRateLimit(
    userId: string,
    action: string,
    limit: number = 100,
    windowMs: number = 60000 // 1 minute
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.limits.get(key);
    
    if (!record || record.resetTime <= windowStart) {
      record = { count: 0, resetTime: now + windowMs };
      this.limits.set(key, record);
    }

    if (record.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
      };
    }

    record.count++;
    
    return {
      allowed: true,
      remaining: limit - record.count,
      resetTime: record.resetTime,
    };
  }

  async cleanupExpiredRecords(): Promise<void> {
    const now = Date.now();
    for (const [key, record] of this.limits.entries()) {
      if (record.resetTime <= now) {
        this.limits.delete(key);
      }
    }
  }
}

export function createR2AuthMiddleware(): R2AuthenticationMiddleware {
  return new R2AuthenticationMiddleware();
}

export function createR2RateLimiter(): R2RateLimiter {
  return new R2RateLimiter();
}