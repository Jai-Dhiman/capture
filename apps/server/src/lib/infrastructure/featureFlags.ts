/**
 * Feature Flag System for Gradual Rollout
 *
 * A/B testing and feature flag system for safely rolling out
 * WASM recommendation engine to production users.
 */

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions?: FeatureFlagCondition[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagCondition {
  type: 'user_id' | 'user_segment' | 'time_range' | 'custom';
  operator: 'equals' | 'contains' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

export interface UserContext {
  userId: string;
  userSegment?: string;
  experimentGroup?: string;
  metadata?: Record<string, any>;
}

export interface ABTestConfig {
  name: string;
  variants: ABTestVariant[];
  trafficAllocation: number; // Percentage of users to include in test
  enabled: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface ABTestVariant {
  name: string;
  weight: number; // Percentage of test traffic
  config: Record<string, any>;
}

export interface ABTestResult {
  variant: string;
  config: Record<string, any>;
  inTest: boolean;
}

export class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: Map<string, FeatureFlag> = new Map();
  private abTests: Map<string, ABTestConfig> = new Map();
  private userAssignments: Map<string, Map<string, string>> = new Map(); // userId -> testName -> variant

  private constructor() {
    this.setupDefaultFlags();
    this.setupDefaultABTests();
  }

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  /**
   * Check if a feature flag is enabled for a user
   */
  isEnabled(flagName: string, userContext: UserContext): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      console.warn(`Feature flag '${flagName}' not found`);
      return false;
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const userHash = this.hashUser(userContext.userId, flagName);
      if (userHash > flag.rolloutPercentage) {
        return false;
      }
    }

    // Check conditions
    if (flag.conditions && flag.conditions.length > 0) {
      return this.evaluateConditions(flag.conditions, userContext);
    }

    return true;
  }

  /**
   * Get AB test variant for a user
   */
  getABTestVariant(testName: string, userContext: UserContext): ABTestResult {
    const test = this.abTests.get(testName);
    if (!test) {
      return { variant: 'control', config: {}, inTest: false };
    }

    // Check if test is enabled and within date range
    if (!test.enabled || !this.isTestActive(test)) {
      return { variant: 'control', config: {}, inTest: false };
    }

    // Check if user is in test traffic
    const trafficHash = this.hashUser(userContext.userId, `${testName}_traffic`);
    if (trafficHash > test.trafficAllocation) {
      return { variant: 'control', config: {}, inTest: false };
    }

    // Get or assign variant
    const variant = this.assignVariant(testName, userContext.userId, test);
    const variantConfig = test.variants.find((v) => v.name === variant);

    return {
      variant,
      config: variantConfig?.config || {},
      inTest: true,
    };
  }

  /**
   * Create or update a feature flag
   */
  setFeatureFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): void {
    const existing = this.flags.get(flag.name);
    const now = new Date();

    const featureFlag: FeatureFlag = {
      ...flag,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.flags.set(flag.name, featureFlag);
    console.log(
      `Feature flag '${flag.name}' updated: enabled=${flag.enabled}, rollout=${flag.rolloutPercentage}%`,
    );
  }

  /**
   * Create or update an AB test
   */
  setABTest(test: ABTestConfig): void {
    // Validate weights sum to 100
    const totalWeight = test.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`AB test variant weights must sum to 100, got ${totalWeight}`);
    }

    this.abTests.set(test.name, test);
    console.log(
      `AB test '${test.name}' updated: enabled=${test.enabled}, variants=${test.variants.length}`,
    );
  }

  /**
   * Get feature flag configuration
   */
  getFeatureFlag(name: string): FeatureFlag | undefined {
    return this.flags.get(name);
  }

  /**
   * Get AB test configuration
   */
  getABTest(name: string): ABTestConfig | undefined {
    return this.abTests.get(name);
  }

  /**
   * List all feature flags
   */
  getAllFeatureFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * List all AB tests
   */
  getAllABTests(): ABTestConfig[] {
    return Array.from(this.abTests.values());
  }

  /**
   * Remove a feature flag
   */
  removeFeatureFlag(name: string): boolean {
    return this.flags.delete(name);
  }

  /**
   * Remove an AB test
   */
  removeABTest(name: string): boolean {
    this.userAssignments.delete(name);
    return this.abTests.delete(name);
  }

  /**
   * Get user's experiment assignments
   */
  getUserAssignments(userId: string): Record<string, string> {
    const assignments = this.userAssignments.get(userId);
    return assignments ? Object.fromEntries(assignments) : {};
  }

  /**
   * Manually assign user to variant (for testing)
   */
  assignUserToVariant(testName: string, userId: string, variant: string): void {
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }
    this.userAssignments.get(userId)!.set(testName, variant);
  }

  /**
   * Check if WASM recommendation engine should be used
   */
  shouldUseWasmEngine(userContext: UserContext): {
    useWasm: boolean;
    variant: string;
    config: Record<string, any>;
  } {
    // Check feature flag first
    const wasmEnabled = this.isEnabled('wasm_recommendations', userContext);
    if (!wasmEnabled) {
      return { useWasm: false, variant: 'disabled', config: {} };
    }

    // Get AB test variant
    const abResult = this.getABTestVariant('wasm_recommendation_rollout', userContext);

    return {
      useWasm: abResult.inTest && abResult.variant !== 'control',
      variant: abResult.variant,
      config: abResult.config,
    };
  }

  /**
   * Check if experimental features should be enabled
   */
  shouldUseExperimentalFeatures(userContext: UserContext): boolean {
    return this.isEnabled('experimental_features', userContext);
  }

  /**
   * Get recommendation engine configuration for user
   */
  getRecommendationConfig(userContext: UserContext): {
    engine: 'typescript' | 'wasm' | 'hybrid';
    features: string[];
    weights?: Record<string, number>;
    options?: Record<string, any>;
  } {
    const wasmResult = this.shouldUseWasmEngine(userContext);
    const experimentalEnabled = this.shouldUseExperimentalFeatures(userContext);

    const features = [];
    if (experimentalEnabled) features.push('experimental');
    if (this.isEnabled('enhanced_similarity', userContext)) features.push('enhanced_similarity');
    if (this.isEnabled('diversity_boost', userContext)) features.push('diversity_boost');
    if (this.isEnabled('content_type_scoring', userContext)) features.push('content_type_scoring');

    return {
      engine: wasmResult.useWasm ? 'wasm' : 'typescript',
      features,
      weights: wasmResult.config.weights,
      options: {
        diversityBoost: wasmResult.config.diversityBoost || 0.1,
        recencyBoost: wasmResult.config.recencyBoost || 0.25,
        engagementBoost: wasmResult.config.engagementBoost || 0.3,
        ...wasmResult.config.options,
      },
    };
  }

  // Private methods

  private hashUser(userId: string, salt: string): number {
    // Simple hash function for consistent user bucketing
    let hash = 0;
    const str = `${userId}_${salt}`;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash) % 100;
  }

  private evaluateConditions(
    conditions: FeatureFlagCondition[],
    userContext: UserContext,
  ): boolean {
    return conditions.every((condition) => this.evaluateCondition(condition, userContext));
  }

  private evaluateCondition(condition: FeatureFlagCondition, userContext: UserContext): boolean {
    let contextValue: any;

    switch (condition.type) {
      case 'user_id':
        contextValue = userContext.userId;
        break;
      case 'user_segment':
        contextValue = userContext.userSegment;
        break;
      case 'time_range':
        contextValue = new Date();
        break;
      case 'custom':
        contextValue = userContext.metadata?.[condition.value?.key];
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'contains':
        return String(contextValue).includes(String(condition.value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(contextValue);
      case 'greater_than':
        return Number(contextValue) > Number(condition.value);
      case 'less_than':
        return Number(contextValue) < Number(condition.value);
      default:
        return false;
    }
  }

  private isTestActive(test: ABTestConfig): boolean {
    const now = new Date();

    if (test.startDate && now < test.startDate) {
      return false;
    }

    if (test.endDate && now > test.endDate) {
      return false;
    }

    return true;
  }

  private assignVariant(testName: string, userId: string, test: ABTestConfig): string {
    // Check if user already has assignment
    const existingAssignment = this.userAssignments.get(userId)?.get(testName);
    if (existingAssignment) {
      return existingAssignment;
    }

    // Assign new variant based on weights
    const hash = this.hashUser(userId, testName);
    let cumulativeWeight = 0;

    for (const variant of test.variants) {
      cumulativeWeight += variant.weight;
      if (hash < cumulativeWeight) {
        // Save assignment
        if (!this.userAssignments.has(userId)) {
          this.userAssignments.set(userId, new Map());
        }
        this.userAssignments.get(userId)!.set(testName, variant.name);

        return variant.name;
      }
    }

    // Fallback to first variant
    return test.variants[0]?.name || 'control';
  }

  private setupDefaultFlags(): void {
    this.setFeatureFlag({
      name: 'wasm_recommendations',
      enabled: true,
      rolloutPercentage: 25, // Start with 25% rollout
      metadata: {
        description: 'Enable WASM-based recommendation engine',
        owner: 'recommendation-team',
      },
    });

    this.setFeatureFlag({
      name: 'experimental_features',
      enabled: true,
      rolloutPercentage: 10, // Limited rollout for experimental features
      metadata: {
        description: 'Enable experimental recommendation features',
        owner: 'recommendation-team',
      },
    });

    this.setFeatureFlag({
      name: 'enhanced_similarity',
      enabled: true,
      rolloutPercentage: 50,
      metadata: {
        description: 'Enable enhanced similarity scoring',
        owner: 'recommendation-team',
      },
    });

    this.setFeatureFlag({
      name: 'diversity_boost',
      enabled: true,
      rolloutPercentage: 75,
      metadata: {
        description: 'Enable diversity boost in recommendations',
        owner: 'recommendation-team',
      },
    });

    this.setFeatureFlag({
      name: 'content_type_scoring',
      enabled: false, // Disabled by default
      rolloutPercentage: 0,
      metadata: {
        description: 'Enable content type-based scoring',
        owner: 'recommendation-team',
      },
    });
  }

  private setupDefaultABTests(): void {
    this.setABTest({
      name: 'wasm_recommendation_rollout',
      enabled: true,
      trafficAllocation: 30, // 30% of users in test
      variants: [
        {
          name: 'control',
          weight: 50, // 50% get TypeScript engine
          config: {
            engine: 'typescript',
            weights: {
              relevance: 0.5,
              recency: 0.025,
              popularity: 0.35,
              diversity: 0.025,
            },
          },
        },
        {
          name: 'wasm_conservative',
          weight: 25, // 25% get WASM with conservative settings
          config: {
            engine: 'wasm',
            diversityBoost: 0.1,
            recencyBoost: 0.2,
            engagementBoost: 0.25,
            weights: {
              relevance: 0.6,
              recency: 0.02,
              popularity: 0.3,
              diversity: 0.02,
            },
          },
        },
        {
          name: 'wasm_aggressive',
          weight: 25, // 25% get WASM with aggressive settings
          config: {
            engine: 'wasm',
            diversityBoost: 0.2,
            recencyBoost: 0.3,
            engagementBoost: 0.4,
            weights: {
              relevance: 0.4,
              recency: 0.05,
              popularity: 0.4,
              diversity: 0.05,
            },
            options: {
              experimentalFeatures: true,
            },
          },
        },
      ],
    });
  }
}

// Export singleton instance
export const featureFlagManager = FeatureFlagManager.getInstance();
