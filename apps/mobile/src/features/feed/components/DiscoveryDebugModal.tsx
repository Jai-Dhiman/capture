import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDiscoveryAnalytics, useDiscoveryPerformanceSummary } from '../hooks/useDiscoveryAnalytics';

interface DiscoveryDebugModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DiscoveryDebugModal: React.FC<DiscoveryDebugModalProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'performance' | 'seen'>('performance');
  
  const { data: analytics, isLoading: analyticsLoading } = useDiscoveryAnalytics(5);
  const { data: performance, isLoading: performanceLoading } = useDiscoveryPerformanceSummary();

  const formatNumber = (num: number, decimals = 2) => {
    return num?.toFixed?.(decimals) || '0';
  };

  const formatMs = (ms: number) => {
    return `${formatNumber(ms, 0)}ms`;
  };

  const formatPercent = (rate: number) => {
    return `${formatNumber(rate * 100, 1)}%`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <Text className="text-lg font-semibold">Discovery Analytics</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-blue-500 font-medium">Done</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View className="flex-row border-b border-gray-200">
          {[
            { key: 'performance', label: 'Performance' },
            { key: 'sessions', label: 'Sessions' },
            { key: 'seen', label: 'Seen Posts' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              className={`flex-1 p-3 items-center ${
                activeTab === tab.key ? 'border-b-2 border-blue-500' : ''
              }`}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Text className={`font-medium ${
                activeTab === tab.key ? 'text-blue-500' : 'text-gray-600'
              }`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <View className="space-y-4">
              <Text className="text-xl font-semibold mb-4">System Performance</Text>
              
              {performanceLoading ? (
                <Text className="text-gray-500">Loading performance data...</Text>
              ) : performance ? (
                <View className="space-y-4">
                  {/* Overall Stats */}
                  <View className="bg-gray-50 p-4 rounded-lg">
                    <Text className="font-semibold mb-2">Overall Statistics</Text>
                    <View className="space-y-2">
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600">Total Sessions:</Text>
                        <Text className="font-medium">{performance.totalSessions}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600">Avg Processing Time:</Text>
                        <Text className="font-medium">{formatMs(performance.averageProcessingTime)}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600">Avg Results per Query:</Text>
                        <Text className="font-medium">{formatNumber(performance.averageResults, 1)}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600">Error Rate:</Text>
                        <Text className={`font-medium ${performance.errorRate > 0.05 ? 'text-red-500' : 'text-green-500'}`}>
                          {formatPercent(performance.errorRate)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600">WASM Usage Rate:</Text>
                        <Text className={`font-medium ${performance.wasmUsageRate > 0.8 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {formatPercent(performance.wasmUsageRate)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Quality Scores */}
                  <View className="bg-blue-50 p-4 rounded-lg">
                    <Text className="font-semibold mb-2">Average Quality Scores</Text>
                    <View className="space-y-2">
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600">Uniqueness Ratio:</Text>
                        <Text className="font-medium">{formatNumber(performance.averageQualityScores.uniquenessRatio)}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600">Freshness Score:</Text>
                        <Text className="font-medium">{formatNumber(performance.averageQualityScores.freshnessScore)}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600">Personal Relevance:</Text>
                        <Text className="font-medium">{formatNumber(performance.averageQualityScores.personalRelevanceScore)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <Text className="text-red-500">Failed to load performance data</Text>
              )}
            </View>
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <View className="space-y-4">
              <Text className="text-xl font-semibold mb-4">Recent Sessions</Text>
              
              {analyticsLoading ? (
                <Text className="text-gray-500">Loading session data...</Text>
              ) : analytics ? (
                <View className="space-y-4">
                  {analytics.sessionLogs.map((session, index) => (
                    <View key={session.sessionId} className="bg-gray-50 p-4 rounded-lg">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="font-semibold">Session #{index + 1}</Text>
                        <Text className="text-sm text-gray-500">
                          {new Date(session.timestamp).toLocaleTimeString()}
                        </Text>
                      </View>
                      
                      <View className="space-y-1 mb-3">
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-gray-600">Phase:</Text>
                          <Text className="text-sm font-medium">{session.phase}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-gray-600">Processing Time:</Text>
                          <Text className="text-sm font-medium">{formatMs(session.processingTimeMs)}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-gray-600">Candidates → Results:</Text>
                          <Text className="text-sm font-medium">
                            {session.candidatesFound} → {session.finalResults}
                          </Text>
                        </View>
                      </View>

                      <View className="border-t border-gray-200 pt-2">
                        <Text className="text-xs font-semibold mb-1">Average Scores:</Text>
                        <View className="flex-row justify-between">
                          <Text className="text-xs text-gray-600">Similarity: {formatNumber(session.averageScores.similarity, 2)}</Text>
                          <Text className="text-xs text-gray-600">Engagement: {formatNumber(session.averageScores.engagement, 2)}</Text>
                          <Text className="text-xs text-gray-600">Final: {formatNumber(session.averageScores.final, 2)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-red-500">Failed to load session data</Text>
              )}
            </View>
          )}

          {/* Seen Posts Tab */}
          {activeTab === 'seen' && (
            <View className="space-y-4">
              <Text className="text-xl font-semibold mb-4">Seen Posts Analytics</Text>
              
              {analyticsLoading ? (
                <Text className="text-gray-500">Loading seen posts data...</Text>
              ) : analytics ? (
                <View className="bg-green-50 p-4 rounded-lg">
                  <Text className="font-semibold mb-3">Seen Posts Effectiveness</Text>
                  <View className="space-y-2">
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600">Avg Seen Posts per User:</Text>
                      <Text className="font-medium">
                        {formatNumber(analytics.seenPostsAnalytics.averageSeenPostsPerUser, 0)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600">Devaluation Rate:</Text>
                      <Text className="font-medium">
                        {formatPercent(analytics.seenPostsAnalytics.averageDevaluationRate)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600">Devaluation Effectiveness:</Text>
                      <Text className="font-medium">
                        {formatNumber(analytics.seenPostsAnalytics.devaluationEffectiveness, 3)}x
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600">Growth Rate:</Text>
                      <Text className="font-medium">
                        {formatNumber(analytics.seenPostsAnalytics.seenPostsGrowthRate, 1)}/day
                      </Text>
                    </View>
                  </View>
                  
                  <View className="mt-3 p-3 bg-white rounded-lg">
                    <Text className="text-xs text-gray-500">
                      💡 Devaluation effectiveness shows the average score multiplier for seen posts. 
                      Lower values mean seen posts are being properly deprioritized.
                    </Text>
                  </View>
                </View>
              ) : (
                <Text className="text-red-500">Failed to load seen posts data</Text>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};