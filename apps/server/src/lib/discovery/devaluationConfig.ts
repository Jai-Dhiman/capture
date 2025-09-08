/**
 * Configuration interface for the context-aware devaluation system
 * Allows easy tuning of devaluation parameters without code changes
 */

export interface DevaluationConfig {
  // Base devaluation settings
  baseDevaluationMultiplier: number; // Base reduction for seen posts (0.5 = 50% reduction)
  minimumRetention: number; // Minimum retention rate (0.2 = 20% minimum)
  
  // Engagement-based adjustments
  highEngagementThreshold: number; // Total interactions needed for "high engagement"
  maxEngagementReduction: number; // Maximum reduction in devaluation for popular posts
  viralVelocityThreshold: number; // Interactions/hour threshold for viral content
  viralMinimumRetention: number; // Minimum retention for viral posts
  
  // View quality multipliers
  viewQualityMultipliers: {
    quick_scroll: number; // Light devaluation
    engaged_view: number; // Heavy devaluation  
    partial_interaction: number; // Medium devaluation
  };
  
  // Content type multipliers
  contentTypeMultipliers: {
    news: number; // Timely content, heavier devaluation
    entertainment: number; // Can be enjoyed multiple times
    educational: number; // Has repeat value
    personal: number; // Less likely to be relevant again
    general: number; // Default fallback
  };
  
  // Session settings
  newSessionMinimumRetention: number; // Lighter devaluation for new sessions
  sessionTimeoutMs: number; // How long before a session expires
  
  // Recovery curve parameters
  dailyRecoveryRate: number; // Daily recovery percentage (0.08 = 8%)
  recoveryTimelineDays: number; // Days for full recovery
}

export const DEFAULT_DEVALUATION_CONFIG: DevaluationConfig = {
  // Base settings - less aggressive than before
  baseDevaluationMultiplier: 0.5, // 50% reduction (was 90%)
  minimumRetention: 0.2, // 20% minimum (was 10%)
  
  // Engagement thresholds
  highEngagementThreshold: 50, // 50+ total interactions
  maxEngagementReduction: 0.4, // Up to 40% less devaluation
  viralVelocityThreshold: 10, // 10+ interactions/hour
  viralMinimumRetention: 0.7, // 70% retention for viral content
  
  // View quality multipliers
  viewQualityMultipliers: {
    quick_scroll: 0.8, // 80% of base devaluation
    engaged_view: 0.3, // 30% of base devaluation
    partial_interaction: 0.5, // 50% of base devaluation
  },
  
  // Content type multipliers
  contentTypeMultipliers: {
    news: 0.2, // 20% of base (heavy devaluation)
    entertainment: 0.6, // 60% of base
    educational: 0.8, // 80% of base (light devaluation)
    personal: 0.4, // 40% of base
    general: 0.5, // 50% of base (neutral)
  },
  
  // Session settings
  newSessionMinimumRetention: 0.6, // 60% minimum for new sessions
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  
  // Recovery parameters - faster than before
  dailyRecoveryRate: 0.08, // 8% daily (was 5%)
  recoveryTimelineDays: 12, // 12 days (was 18)
};

/**
 * Load devaluation configuration from environment or use defaults
 * This allows runtime configuration without code deployment
 */
export function loadDevaluationConfig(bindings?: any): DevaluationConfig {
  // In production, you could load from bindings.DEVALUATION_CONFIG
  // or from a database table for dynamic configuration
  
  if (bindings?.DEVALUATION_CONFIG) {
    try {
      const customConfig = JSON.parse(bindings.DEVALUATION_CONFIG);
      return { ...DEFAULT_DEVALUATION_CONFIG, ...customConfig };
    } catch (error) {
      console.warn('Failed to parse DEVALUATION_CONFIG, using defaults:', error);
    }
  }
  
  return DEFAULT_DEVALUATION_CONFIG;
}

/**
 * Experimental configuration presets for A/B testing
 */
export const EXPERIMENTAL_CONFIGS = {
  // Even more aggressive engagement boosting
  HIGH_ENGAGEMENT_BOOST: {
    ...DEFAULT_DEVALUATION_CONFIG,
    maxEngagementReduction: 0.6, // 60% reduction for popular posts
    viralMinimumRetention: 0.8, // 80% retention for viral
  } as DevaluationConfig,
  
  // More conservative approach
  CONSERVATIVE: {
    ...DEFAULT_DEVALUATION_CONFIG,
    baseDevaluationMultiplier: 0.7, // Only 30% reduction
    minimumRetention: 0.3, // 30% minimum
    newSessionMinimumRetention: 0.8, // 80% for new sessions
  } as DevaluationConfig,
  
  // Content-type focused
  CONTENT_AWARE: {
    ...DEFAULT_DEVALUATION_CONFIG,
    contentTypeMultipliers: {
      news: 0.1, // Heavy devaluation for news
      entertainment: 0.8, // Light devaluation for entertainment
      educational: 0.9, // Very light for educational
      personal: 0.2, // Heavy for personal posts
      general: 0.5,
    },
  } as DevaluationConfig,
};

/**
 * Validate configuration values to prevent invalid settings
 */
export function validateDevaluationConfig(config: DevaluationConfig): string[] {
  const errors: string[] = [];
  
  // Check ranges
  if (config.baseDevaluationMultiplier <= 0 || config.baseDevaluationMultiplier > 1) {
    errors.push('baseDevaluationMultiplier must be between 0 and 1');
  }
  
  if (config.minimumRetention <= 0 || config.minimumRetention > 1) {
    errors.push('minimumRetention must be between 0 and 1');
  }
  
  if (config.minimumRetention > config.baseDevaluationMultiplier) {
    errors.push('minimumRetention cannot be higher than baseDevaluationMultiplier');
  }
  
  // Check thresholds
  if (config.highEngagementThreshold <= 0) {
    errors.push('highEngagementThreshold must be positive');
  }
  
  if (config.viralVelocityThreshold <= 0) {
    errors.push('viralVelocityThreshold must be positive');
  }
  
  // Check recovery parameters
  if (config.dailyRecoveryRate <= 0 || config.dailyRecoveryRate > 0.5) {
    errors.push('dailyRecoveryRate should be between 0 and 0.5');
  }
  
  if (config.recoveryTimelineDays <= 0 || config.recoveryTimelineDays > 30) {
    errors.push('recoveryTimelineDays should be between 1 and 30');
  }
  
  return errors;
}