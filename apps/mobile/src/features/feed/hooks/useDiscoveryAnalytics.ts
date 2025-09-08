import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { useQuery } from '@tanstack/react-query';

interface DiscoveryAnalytics {
  sessionLogs: Array<{
    userId: string;
    sessionId: string;
    timestamp: number;
    phase: string;
    processingTimeMs: number;
    candidatesFound: number;
    candidatesProcessed: number;
    finalResults: number;
    averageScores: {
      similarity: number;
      engagement: number;
      diversity: number;
      temporal: number;
      privacy: number;
      final: number;
    };
    qualityMetrics: {
      uniquenessRatio: number;
      freshnessScore: number;
      personalRelevanceScore: number;
    };
    devaluationStats: {
      devaluedCount: number;
      averageMultiplier: number;
    };
    options: {
      limit: number;
      experimentalFeatures: boolean;
      adaptiveParameters: boolean;
    };
  }>;
  seenPostsAnalytics: {
    averageSeenPostsPerUser: number;
    averageDevaluationRate: number;
    devaluationEffectiveness: number;
    seenPostsGrowthRate: number;
  };
}

interface PerformanceSummary {
  totalSessions: number;
  averageProcessingTime: number;
  averageResults: number;
  errorRate: number;
  wasmUsageRate: number;
  averageQualityScores: {
    uniquenessRatio: number;
    freshnessScore: number;
    personalRelevanceScore: number;
  };
}

export const useDiscoveryAnalytics = (limit = 5) => {
  return useQuery<DiscoveryAnalytics, Error>({
    queryKey: ['discoveryAnalytics', limit],
    queryFn: async () => {
      const data = await graphqlFetch<{ discoveryAnalytics: DiscoveryAnalytics }>({
        query: `
          query GetDiscoveryAnalytics($limit: Int) {
            discoveryAnalytics(limit: $limit) {
              sessionLogs {
                userId
                sessionId
                timestamp
                phase
                processingTimeMs
                candidatesFound
                candidatesProcessed
                finalResults
                averageScores {
                  similarity
                  engagement
                  diversity
                  temporal
                  privacy
                  final
                }
                qualityMetrics {
                  uniquenessRatio
                  freshnessScore
                  personalRelevanceScore
                }
                devaluationStats {
                  devaluedCount
                  averageMultiplier
                }
                options {
                  limit
                  experimentalFeatures
                  adaptiveParameters
                }
              }
              seenPostsAnalytics {
                averageSeenPostsPerUser
                averageDevaluationRate
                devaluationEffectiveness
                seenPostsGrowthRate
              }
            }
          }
        `,
        variables: { limit },
      });

      return data.discoveryAnalytics;
    },
    staleTime: 30_000, // 30 seconds
    retry: 1,
  });
};

export const useDiscoveryPerformanceSummary = () => {
  return useQuery<PerformanceSummary, Error>({
    queryKey: ['discoveryPerformanceSummary'],
    queryFn: async () => {
      const data = await graphqlFetch<{ discoveryPerformanceSummary: PerformanceSummary }>({
        query: `
          query GetDiscoveryPerformanceSummary {
            discoveryPerformanceSummary {
              totalSessions
              averageProcessingTime
              averageResults
              errorRate
              wasmUsageRate
              averageQualityScores {
                uniquenessRatio
                freshnessScore
                personalRelevanceScore
              }
            }
          }
        `,
      });

      return data.discoveryPerformanceSummary;
    },
    staleTime: 60_000, // 1 minute
    retry: 1,
  });
};