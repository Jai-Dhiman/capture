import React from 'react';
import { View } from 'react-native';

interface CommentSkeletonProps {
  isReply?: boolean;
  replyCount?: number;
}

export const CommentSkeleton: React.FC<CommentSkeletonProps> = ({ 
  isReply = false,
  replyCount = 0
}) => {
  return (
    <View className={`mb-3 ${isReply ? 'ml-8' : ''}`}>
      <View className="flex-row">
        {/* Avatar skeleton */}
        <View className="w-8 h-8 rounded-full overflow-hidden mr-3 bg-gray-200 animate-pulse" />
        
        {/* Comment content skeleton */}
        <View className="flex-1 bg-gray-50 rounded-lg p-2">
          {/* Username skeleton */}
          <View className="h-4 w-24 bg-gray-200 rounded-md animate-pulse" />
          
          {/* Content skeleton - multiple lines */}
          <View className="mt-2">
            <View className="h-3 bg-gray-200 rounded-md w-full animate-pulse mt-1" />
            <View className="h-3 bg-gray-200 rounded-md w-5/6 animate-pulse mt-1" />
            <View className="h-3 bg-gray-200 rounded-md w-4/6 animate-pulse mt-1" />
          </View>
          
          {/* Date skeleton */}
          <View className="h-3 w-16 bg-gray-200 rounded-md animate-pulse mt-2" />
        </View>
      </View>

      {/* Render reply skeletons if needed */}
      {!isReply && replyCount > 0 && (
        <View className="mt-2 ml-11">
          <View className="h-3 w-24 bg-gray-200 rounded-md animate-pulse" />
          {replyCount > 0 && Array(Math.min(replyCount, 2)).fill(0).map((_, index) => (
            <CommentSkeleton key={`reply-skeleton-${index}`} isReply={true} />
          ))}
        </View>
      )}
    </View>
  );
};