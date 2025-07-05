/**
 * Migration Strategy for WASM Recommendation System
 *
 * This module provides a safe, gradual migration path from the existing
 * TypeScript recommendation system to the new WASM-based implementation.
 */

import { wasmRecommendationEngine } from './recommendationEngine.js';
import { WasmPerformanceMonitor } from './wasmUtils.js';
import { cachingService } from './cachingService.js';

export interface MigrationConfig {
  wasmEnabledPercentage: number; // 0-100: percentage of users to use WASM
  enableFallback: boolean; // Whether to fallback to original on WASM failure
  enablePerformanceComparison: boolean; // Whether to run both algorithms for comparison
  maxWasmLatency: number; // Max acceptable WASM latency in ms
  enabledFeatures: {
    discoveryFeed: boolean;
    similarContent: boolean;
    userPreferences: boolean;
    batchProcessing: boolean;
  };
  rolloutStrategy: 'percentage' | 'userList' | 'feature' | 'gradual';
  testUserIds?: string[]; // Specific users for testing
}

export interface MigrationMetrics {
  wasmUsageCount: number;
  originalUsageCount: number;
  wasmFailureCount: number;
  averageWasmLatency: number;
  averageOriginalLatency: number;
  wasmSuccessRate: number;
  performanceImprovement: number;
}

const performanceMonitor = WasmPerformanceMonitor.getInstance();

/**
 * Migration manager for gradual WASM rollout
 */
export class WasmMigrationManager {
  private static instance: WasmMigrationManager;
  private config: MigrationConfig;
  private metrics: MigrationMetrics;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.metrics = this.initializeMetrics();
  }

  static getInstance(): WasmMigrationManager {
    if (!WasmMigrationManager.instance) {
      WasmMigrationManager.instance = new WasmMigrationManager();
    }
    return WasmMigrationManager.instance;
  }

  /**
   * Update migration configuration
   */
  updateConfig(newConfig: Partial<MigrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Migration config updated:', this.config);
  }

  /**
   * Determine if a user should use WASM algorithm
   */
  shouldUseWasm(userId: string, feature: keyof MigrationConfig['enabledFeatures']): boolean {
    // Check if feature is enabled
    if (!this.config.enabledFeatures[feature]) {
      return false;
    }

    // Strategy-based decision
    switch (this.config.rolloutStrategy) {
      case 'userList':
        return this.config.testUserIds?.includes(userId) || false;

      case 'percentage':
        return this.getUserPercentage(userId) < this.config.wasmEnabledPercentage;

      case 'feature':
        // Feature-specific rollout logic
        return this.getFeatureRollout(feature);

      case 'gradual':
        // Gradual rollout based on metrics
        return this.getGradualRollout(userId);

      default:
        return false;
    }
  }

  /**
   * Execute discovery feed with migration logic
   */
  async executeDiscoveryFeed(
    userId: string,
    originalFunction: () => Promise<any>,
    wasmFunction: () => Promise<any>,
  ): Promise<any> {
    const shouldUseWasm = this.shouldUseWasm(userId, 'discoveryFeed');

    if (!shouldUseWasm) {
      this.metrics.originalUsageCount++;
      return await this.executeWithMetrics('original-discovery', originalFunction);
    }

    // Try WASM first
    try {
      const result = await this.executeWithMetrics('wasm-discovery', wasmFunction);
      this.metrics.wasmUsageCount++;

      // Run comparison if enabled
      if (this.config.enablePerformanceComparison) {
        this.runPerformanceComparison(originalFunction, wasmFunction);
      }

      return result;
    } catch (error) {
      console.error('WASM discovery feed failed:', error);
      this.metrics.wasmFailureCount++;

      // Fallback to original if enabled
      if (this.config.enableFallback) {
        console.log('Falling back to original algorithm');
        this.metrics.originalUsageCount++;
        return await this.executeWithMetrics('original-discovery-fallback', originalFunction);
      }

      throw error;
    }
  }

  /**
   * Execute similar content with migration logic
   */
  async executeSimilarContent(
    userId: string,
    originalFunction: () => Promise<any>,
    wasmFunction: () => Promise<any>,
  ): Promise<any> {
    const shouldUseWasm = this.shouldUseWasm(userId, 'similarContent');

    if (!shouldUseWasm) {
      this.metrics.originalUsageCount++;
      return await this.executeWithMetrics('original-similar', originalFunction);
    }

    try {
      const result = await this.executeWithMetrics('wasm-similar', wasmFunction);
      this.metrics.wasmUsageCount++;
      return result;
    } catch (error) {
      console.error('WASM similar content failed:', error);
      this.metrics.wasmFailureCount++;

      if (this.config.enableFallback) {
        console.log('Falling back to original similar content algorithm');
        this.metrics.originalUsageCount++;
        return await this.executeWithMetrics('original-similar-fallback', originalFunction);
      }

      throw error;
    }
  }

  /**
   * Get current migration metrics
   */
  getMetrics(): MigrationMetrics {
    const wasmMetrics = performanceMonitor.getMetrics('wasm-discovery');
    const originalMetrics = performanceMonitor.getMetrics('original-discovery');

    this.metrics.averageWasmLatency = wasmMetrics.avg || 0;
    this.metrics.averageOriginalLatency = originalMetrics.avg || 0;
    this.metrics.wasmSuccessRate =
      this.metrics.wasmUsageCount > 0
        ? (this.metrics.wasmUsageCount - this.metrics.wasmFailureCount) /
          this.metrics.wasmUsageCount
        : 0;
    this.metrics.performanceImprovement =
      this.metrics.averageOriginalLatency > 0
        ? this.metrics.averageOriginalLatency / this.metrics.averageWasmLatency
        : 0;

    return { ...this.metrics };
  }

  /**
   * Get migration status report
   */
  getStatusReport(): {
    config: MigrationConfig;
    metrics: MigrationMetrics;
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const recommendations: string[] = [];

    // Generate recommendations based on metrics
    if (metrics.wasmSuccessRate < 0.95) {
      recommendations.push('WASM success rate is low - consider reducing rollout percentage');
    }

    if (metrics.averageWasmLatency > this.config.maxWasmLatency) {
      recommendations.push('WASM latency is high - consider optimizing or reducing load');
    }

    if (metrics.performanceImprovement > 2.0 && metrics.wasmSuccessRate > 0.98) {
      recommendations.push('WASM is performing well - consider increasing rollout percentage');
    }

    if (metrics.wasmFailureCount > 10) {
      recommendations.push('High WASM failure count - investigate error patterns');
    }

    return {
      config: this.config,
      metrics,
      recommendations,
    };
  }

  /**
   * Auto-adjust migration based on performance
   */
  async autoAdjustMigration(): Promise<void> {
    const metrics = this.getMetrics();

    // Auto-reduce if failure rate is high
    if (metrics.wasmSuccessRate < 0.9 && this.config.wasmEnabledPercentage > 10) {
      const newPercentage = Math.max(10, this.config.wasmEnabledPercentage - 10);
      console.log(
        `Auto-reducing WASM percentage from ${this.config.wasmEnabledPercentage}% to ${newPercentage}%`,
      );
      this.updateConfig({ wasmEnabledPercentage: newPercentage });
    }

    // Auto-increase if performance is excellent
    if (
      metrics.wasmSuccessRate > 0.99 &&
      metrics.performanceImprovement > 2.0 &&
      this.config.wasmEnabledPercentage < 100
    ) {
      const newPercentage = Math.min(100, this.config.wasmEnabledPercentage + 10);
      console.log(
        `Auto-increasing WASM percentage from ${this.config.wasmEnabledPercentage}% to ${newPercentage}%`,
      );
      this.updateConfig({ wasmEnabledPercentage: newPercentage });
    }
  }

  /**
   * Create migration rollout plan
   */
  createRolloutPlan(
    targetPercentage: number,
    daysToRollout: number,
  ): Array<{
    day: number;
    percentage: number;
    actions: string[];
  }> {
    const currentPercentage = this.config.wasmEnabledPercentage;
    const dailyIncrease = (targetPercentage - currentPercentage) / daysToRollout;

    const plan: Array<{ day: number; percentage: number; actions: string[] }> = [];

    for (let day = 1; day <= daysToRollout; day++) {
      const percentage = Math.min(
        targetPercentage,
        Math.round(currentPercentage + dailyIncrease * day),
      );

      const actions: string[] = [
        `Update WASM percentage to ${percentage}%`,
        'Monitor error rates and performance',
        'Check user feedback and metrics',
      ];

      if (day === 1) {
        actions.push('Enable detailed logging and monitoring');
      }

      if (percentage >= 50 && day > 1) {
        actions.push('Run A/B testing analysis');
      }

      if (percentage >= 100) {
        actions.push('Complete migration - disable original algorithm');
        actions.push('Update documentation');
        actions.push('Clean up legacy code');
      }

      plan.push({ day, percentage, actions });
    }

    return plan;
  }

  // Private helper methods

  private getDefaultConfig(): MigrationConfig {
    return {
      wasmEnabledPercentage: 10, // Start with 10% of users
      enableFallback: true,
      enablePerformanceComparison: true,
      maxWasmLatency: 1000, // 1 second
      enabledFeatures: {
        discoveryFeed: true,
        similarContent: true,
        userPreferences: false, // Start conservative
        batchProcessing: false,
      },
      rolloutStrategy: 'percentage',
    };
  }

  private initializeMetrics(): MigrationMetrics {
    return {
      wasmUsageCount: 0,
      originalUsageCount: 0,
      wasmFailureCount: 0,
      averageWasmLatency: 0,
      averageOriginalLatency: 0,
      wasmSuccessRate: 0,
      performanceImprovement: 0,
    };
  }

  private getUserPercentage(userId: string): number {
    // Simple hash-based percentage assignment
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  private getFeatureRollout(feature: keyof MigrationConfig['enabledFeatures']): boolean {
    // Feature-specific rollout logic
    const featureRollouts = {
      discoveryFeed: 50, // 50% rollout
      similarContent: 30, // 30% rollout
      userPreferences: 10, // 10% rollout
      batchProcessing: 5, // 5% rollout
    };

    return Math.random() * 100 < featureRollouts[feature];
  }

  private getGradualRollout(userId: string): boolean {
    const metrics = this.getMetrics();

    // Increase rollout based on success rate
    let adjustedPercentage = this.config.wasmEnabledPercentage;

    if (metrics.wasmSuccessRate > 0.98) {
      adjustedPercentage = Math.min(100, adjustedPercentage * 1.2);
    } else if (metrics.wasmSuccessRate < 0.9) {
      adjustedPercentage = Math.max(1, adjustedPercentage * 0.8);
    }

    return this.getUserPercentage(userId) < adjustedPercentage;
  }

  private async executeWithMetrics<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    return performanceMonitor.measureOperation(operationName, fn);
  }

  private async runPerformanceComparison(
    originalFunction: () => Promise<any>,
    wasmFunction: () => Promise<any>,
  ): Promise<void> {
    // Run comparison in background without affecting user experience
    setTimeout(async () => {
      try {
        const originalStart = performance.now();
        await originalFunction();
        const originalTime = performance.now() - originalStart;

        const wasmStart = performance.now();
        await wasmFunction();
        const wasmTime = performance.now() - wasmStart;

        console.log(
          `Performance comparison - Original: ${originalTime.toFixed(2)}ms, WASM: ${wasmTime.toFixed(2)}ms, Speedup: ${(originalTime / wasmTime).toFixed(2)}x`,
        );
      } catch (error) {
        console.error('Performance comparison failed:', error);
      }
    }, 0);
  }
}

/**
 * Migration utilities for resolver integration
 */
export class MigrationUtils {
  private static migrationManager = WasmMigrationManager.getInstance();

  /**
   * Wrapper for discovery feed resolver with migration logic
   */
  static async withMigration<T>(
    userId: string,
    feature: keyof MigrationConfig['enabledFeatures'],
    originalFunction: () => Promise<T>,
    wasmFunction: () => Promise<T>,
  ): Promise<T> {
    switch (feature) {
      case 'discoveryFeed':
        return this.migrationManager.executeDiscoveryFeed(userId, originalFunction, wasmFunction);
      case 'similarContent':
        return this.migrationManager.executeSimilarContent(userId, originalFunction, wasmFunction);
      default:
        // For other features, simple on/off switch
        const shouldUseWasm = this.migrationManager.shouldUseWasm(userId, feature);
        return shouldUseWasm ? wasmFunction() : originalFunction();
    }
  }

  /**
   * Get migration status for admin/monitoring
   */
  static getMigrationStatus() {
    return this.migrationManager.getStatusReport();
  }

  /**
   * Update migration configuration
   */
  static updateMigrationConfig(config: Partial<MigrationConfig>) {
    this.migrationManager.updateConfig(config);
  }

  /**
   * Auto-adjust migration based on performance
   */
  static async autoAdjustMigration() {
    await this.migrationManager.autoAdjustMigration();
  }

  /**
   * Create rollout plan
   */
  static createRolloutPlan(targetPercentage: number, daysToRollout: number) {
    return this.migrationManager.createRolloutPlan(targetPercentage, daysToRollout);
  }
}

// Export singleton instance
export const migrationManager = WasmMigrationManager.getInstance();
