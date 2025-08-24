/**
 * Discovery Feed Performance Logger
 * 
 * Comprehensive logging system for recommendation system analysis and debugging
 */

export interface DiscoveryLogEntry {
  userId: string;
  sessionId: string;
  requestId: string;
  timestamp: number;
  phase: 'start' | 'candidate_retrieval' | 'wasm_processing' | 'ranking' | 'complete' | 'error';
  metrics: {
    // Performance metrics
    processingTimeMs: number;
    candidatesFound: number;
    candidatesProcessed: number;
    finalResults: number;
    
    // Algorithm effectiveness
    averageSimilarityScore: number;
    averageEngagementScore: number;
    averageDiversityScore: number;
    averageTemporalScore: number;
    averagePrivacyScore: number;
    averageFinalScore: number;
    
    // Seen posts analysis
    seenPostsTotal: number;
    seenPostsFiltered: number;
    seenPostsDevalued: number;
    averageDevaluationMultiplier: number;
    
    // User context
    userEmbeddingDimensions: number;
    userEngagementRate: number;
    userDiversityPreference: number;
    
    // Content distribution
    contentTypeBreakdown: Record<string, number>;
    ageDistributionHours: {
      lessThan1: number;
      oneToSix: number;
      sixToTwentyFour: number;
      moreThanTwentyFour: number;
    };
    
    // WASM performance
    wasmOperationsUsed: string[];
    wasmFallbacksUsed: string[];
    wasmMemoryUsage?: number;
    
    // Quality metrics
    uniquenessRatio: number; // How diverse the results are
    freshnessScore: number; // Average post age score
    personalRelevanceScore: number; // How well matched to user
    
    // Error tracking
    errors: string[];
    warnings: string[];
  };
  options: {
    limit: number;
    cursor?: string;
    experimentalFeatures: boolean;
    adaptiveParameters: boolean;
  };
  results?: {
    postIds: string[];
    hasMore: boolean;
    nextCursor?: string;
  };
}

export class DiscoveryLogger {
  private static instance: DiscoveryLogger;
  private logs: Map<string, DiscoveryLogEntry[]> = new Map();
  private maxLogsPerUser = 50; // Keep last 50 requests per user
  private sessionLogs: DiscoveryLogEntry[] = []; // Current session logs

  static getInstance(): DiscoveryLogger {
    if (!DiscoveryLogger.instance) {
      DiscoveryLogger.instance = new DiscoveryLogger();
    }
    return DiscoveryLogger.instance;
  }

  /**
   * Start a new discovery session
   */
  startSession(userId: string, options: DiscoveryLogEntry['options']): string {
    const sessionId = this.generateSessionId();
    const requestId = this.generateRequestId();
    
    const entry: DiscoveryLogEntry = {
      userId,
      sessionId,
      requestId,
      timestamp: Date.now(),
      phase: 'start',
      metrics: this.getEmptyMetrics(),
      options,
    };

    this.addLog(userId, entry);
    console.log(`🔍 Discovery Session Started: ${sessionId} for user ${userId}`, {
      options,
      timestamp: new Date().toISOString(),
    });

    return sessionId;
  }

  /**
   * Log candidate retrieval phase
   */
  logCandidateRetrieval(
    userId: string, 
    sessionId: string,
    candidates: any[],
    seenPosts: any[],
    processingTimeMs: number
  ): void {
    const entry = this.findLatestEntry(userId, sessionId);
    if (!entry) return;

    entry.phase = 'candidate_retrieval';
    entry.metrics.candidatesFound = candidates.length;
    entry.metrics.seenPostsTotal = seenPosts.length;
    entry.metrics.processingTimeMs += processingTimeMs;

    // Analyze candidate age distribution
    const now = Date.now();
    entry.metrics.ageDistributionHours = {
      lessThan1: 0,
      oneToSix: 0,
      sixToTwentyFour: 0,
      moreThanTwentyFour: 0,
    };

    candidates.forEach(candidate => {
      const ageHours = (now - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours < 1) entry.metrics.ageDistributionHours.lessThan1++;
      else if (ageHours < 6) entry.metrics.ageDistributionHours.oneToSix++;
      else if (ageHours < 24) entry.metrics.ageDistributionHours.sixToTwentyFour++;
      else entry.metrics.ageDistributionHours.moreThanTwentyFour++;
    });

    console.log(`📊 Candidates Retrieved: ${candidates.length} posts, ${seenPosts.length} seen posts`, {
      sessionId,
      ageDistribution: entry.metrics.ageDistributionHours,
      processingTimeMs,
    });
  }

  /**
   * Log WASM processing phase
   */
  logWasmProcessing(
    userId: string,
    sessionId: string,
    processedCandidates: any[],
    wasmOps: string[],
    fallbacks: string[],
    processingTimeMs: number,
    devaluationStats: {
      devaluedCount: number;
      averageMultiplier: number;
    }
  ): void {
    const entry = this.findLatestEntry(userId, sessionId);
    if (!entry) return;

    entry.phase = 'wasm_processing';
    entry.metrics.candidatesProcessed = processedCandidates.length;
    entry.metrics.wasmOperationsUsed = wasmOps;
    entry.metrics.wasmFallbacksUsed = fallbacks;
    entry.metrics.processingTimeMs += processingTimeMs;
    entry.metrics.seenPostsDevalued = devaluationStats.devaluedCount;
    entry.metrics.averageDevaluationMultiplier = devaluationStats.averageMultiplier;

    // Calculate average scores
    if (processedCandidates.length > 0) {
      entry.metrics.averageSimilarityScore = this.average(processedCandidates.map(p => p.scores.similarity));
      entry.metrics.averageEngagementScore = this.average(processedCandidates.map(p => p.scores.engagement));
      entry.metrics.averageDiversityScore = this.average(processedCandidates.map(p => p.scores.diversity));
      entry.metrics.averageTemporalScore = this.average(processedCandidates.map(p => p.scores.temporal));
      entry.metrics.averagePrivacyScore = this.average(processedCandidates.map(p => p.scores.privacy));
      entry.metrics.averageFinalScore = this.average(processedCandidates.map(p => p.scores.final));
    }

    console.log(`⚡ WASM Processing Complete: ${processedCandidates.length} candidates processed`, {
      sessionId,
      averageScores: {
        similarity: entry.metrics.averageSimilarityScore,
        engagement: entry.metrics.averageEngagementScore,
        diversity: entry.metrics.averageDiversityScore,
        temporal: entry.metrics.averageTemporalScore,
        final: entry.metrics.averageFinalScore,
      },
      devaluationStats,
      wasmOps,
      fallbacks: fallbacks.length > 0 ? fallbacks : undefined,
    });
  }

  /**
   * Log final ranking and results
   */
  logResults(
    userId: string,
    sessionId: string,
    finalPosts: any[],
    hasMore: boolean,
    nextCursor?: string,
    processingTimeMs?: number
  ): void {
    const entry = this.findLatestEntry(userId, sessionId);
    if (!entry) return;

    entry.phase = 'complete';
    entry.metrics.finalResults = finalPosts.length;
    if (processingTimeMs) entry.metrics.processingTimeMs += processingTimeMs;
    
    entry.results = {
      postIds: finalPosts.map(p => p.id),
      hasMore,
      nextCursor,
    };

    // Calculate quality metrics
    if (finalPosts.length > 0) {
      // Uniqueness ratio (how diverse are the final results)
      const uniqueUsers = new Set(finalPosts.map(p => p.userId)).size;
      entry.metrics.uniquenessRatio = uniqueUsers / finalPosts.length;

      // Freshness score (average age penalty)
      const now = Date.now();
      const ageScores = finalPosts.map(p => {
        const ageHours = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
        return Math.exp(-0.1 * ageHours); // Exponential decay
      });
      entry.metrics.freshnessScore = this.average(ageScores);

      // Personal relevance (how well matched to user preferences)
      entry.metrics.personalRelevanceScore = entry.metrics.averageFinalScore;
    }

    console.log(`✅ Discovery Session Complete: ${finalPosts.length} results returned`, {
      sessionId,
      totalProcessingTimeMs: entry.metrics.processingTimeMs,
      qualityMetrics: {
        uniquenessRatio: entry.metrics.uniquenessRatio,
        freshnessScore: entry.metrics.freshnessScore,
        personalRelevanceScore: entry.metrics.personalRelevanceScore,
      },
      pipelineEfficiency: {
        candidatesFound: entry.metrics.candidatesFound,
        candidatesProcessed: entry.metrics.candidatesProcessed,
        finalResults: entry.metrics.finalResults,
        conversionRate: entry.metrics.candidatesFound > 0 
          ? (entry.metrics.finalResults / entry.metrics.candidatesFound * 100).toFixed(1) + '%'
          : '0%',
      },
      hasMore,
    });

    // Store session summary for analysis
    this.sessionLogs.push({ ...entry });
    if (this.sessionLogs.length > 100) {
      this.sessionLogs.shift(); // Keep last 100 sessions
    }
  }

  /**
   * Log errors
   */
  logError(userId: string, sessionId: string, error: Error, phase: string): void {
    const entry = this.findLatestEntry(userId, sessionId);
    if (entry) {
      entry.phase = 'error';
      entry.metrics.errors.push(`${phase}: ${error.message}`);
    }

    console.error(`❌ Discovery Error in ${phase}:`, {
      sessionId,
      userId,
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * Log warnings
   */
  logWarning(userId: string, sessionId: string, message: string, context?: any): void {
    const entry = this.findLatestEntry(userId, sessionId);
    if (entry) {
      entry.metrics.warnings.push(message);
    }

    console.warn(`⚠️ Discovery Warning: ${message}`, {
      sessionId,
      userId,
      context,
    });
  }

  /**
   * Get session analytics for debugging
   */
  getSessionAnalytics(userId: string, limit = 10): DiscoveryLogEntry[] {
    const userLogs = this.logs.get(userId) || [];
    return userLogs.slice(-limit);
  }

  /**
   * Get performance summary across all recent sessions
   */
  getPerformanceSummary(): {
    totalSessions: number;
    averageProcessingTime: number;
    averageResults: number;
    errorRate: number;
    wasmUsageRate: number;
    averageQualityScores: {
      uniqueness: number;
      freshness: number;
      relevance: number;
    };
  } {
    if (this.sessionLogs.length === 0) {
      return {
        totalSessions: 0,
        averageProcessingTime: 0,
        averageResults: 0,
        errorRate: 0,
        wasmUsageRate: 0,
        averageQualityScores: { uniqueness: 0, freshness: 0, relevance: 0 },
      };
    }

    const completedSessions = this.sessionLogs.filter(log => log.phase === 'complete');
    const errorSessions = this.sessionLogs.filter(log => log.phase === 'error');
    const wasmSessions = this.sessionLogs.filter(log => log.metrics.wasmOperationsUsed.length > 0);

    return {
      totalSessions: this.sessionLogs.length,
      averageProcessingTime: this.average(completedSessions.map(log => log.metrics.processingTimeMs)),
      averageResults: this.average(completedSessions.map(log => log.metrics.finalResults)),
      errorRate: errorSessions.length / this.sessionLogs.length,
      wasmUsageRate: wasmSessions.length / this.sessionLogs.length,
      averageQualityScores: {
        uniqueness: this.average(completedSessions.map(log => log.metrics.uniquenessRatio)),
        freshness: this.average(completedSessions.map(log => log.metrics.freshnessScore)),
        relevance: this.average(completedSessions.map(log => log.metrics.personalRelevanceScore)),
      },
    };
  }

  /**
   * Check seen posts effectiveness
   */
  getSeenPostsAnalytics(): {
    averageSeenPostsPerUser: number;
    averageDevaluationRate: number;
    devaluationEffectiveness: number;
    seenPostsGrowthRate: number;
  } {
    const recentLogs = this.sessionLogs.slice(-20); // Last 20 sessions
    if (recentLogs.length === 0) {
      return {
        averageSeenPostsPerUser: 0,
        averageDevaluationRate: 0,
        devaluationEffectiveness: 0,
        seenPostsGrowthRate: 0,
      };
    }

    return {
      averageSeenPostsPerUser: this.average(recentLogs.map(log => log.metrics.seenPostsTotal)),
      averageDevaluationRate: this.average(recentLogs.map(log => 
        log.metrics.seenPostsTotal > 0 
          ? log.metrics.seenPostsDevalued / log.metrics.seenPostsTotal 
          : 0
      )),
      devaluationEffectiveness: this.average(recentLogs.map(log => log.metrics.averageDevaluationMultiplier)),
      seenPostsGrowthRate: recentLogs.length > 1 
        ? (recentLogs[recentLogs.length - 1].metrics.seenPostsTotal - recentLogs[0].metrics.seenPostsTotal) / recentLogs.length
        : 0,
    };
  }

  private generateSessionId(): string {
    return `ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private findLatestEntry(userId: string, sessionId: string): DiscoveryLogEntry | null {
    const userLogs = this.logs.get(userId) || [];
    return userLogs.find(log => log.sessionId === sessionId) || null;
  }

  private addLog(userId: string, entry: DiscoveryLogEntry): void {
    if (!this.logs.has(userId)) {
      this.logs.set(userId, []);
    }
    
    const userLogs = this.logs.get(userId)!;
    userLogs.push(entry);
    
    // Keep only recent logs
    if (userLogs.length > this.maxLogsPerUser) {
      userLogs.shift();
    }
  }

  private getEmptyMetrics(): DiscoveryLogEntry['metrics'] {
    return {
      processingTimeMs: 0,
      candidatesFound: 0,
      candidatesProcessed: 0,
      finalResults: 0,
      averageSimilarityScore: 0,
      averageEngagementScore: 0,
      averageDiversityScore: 0,
      averageTemporalScore: 0,
      averagePrivacyScore: 0,
      averageFinalScore: 0,
      seenPostsTotal: 0,
      seenPostsFiltered: 0,
      seenPostsDevalued: 0,
      averageDevaluationMultiplier: 1,
      userEmbeddingDimensions: 0,
      userEngagementRate: 0,
      userDiversityPreference: 0,
      contentTypeBreakdown: {},
      ageDistributionHours: {
        lessThan1: 0,
        oneToSix: 0,
        sixToTwentyFour: 0,
        moreThanTwentyFour: 0,
      },
      wasmOperationsUsed: [],
      wasmFallbacksUsed: [],
      uniquenessRatio: 0,
      freshnessScore: 0,
      personalRelevanceScore: 0,
      errors: [],
      warnings: [],
    };
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + (num || 0), 0) / numbers.length;
  }
}

// Export singleton instance
export const discoveryLogger = DiscoveryLogger.getInstance();