import React from 'react';
import { View } from 'react-native';
import { AutoSkeletonView } from 'react-native-auto-skeleton';

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
      <AutoSkeletonView isLoading={true}>
        <View className="flex-row items-start">
          <View className={`${isReply ? 'w-8 h-8' : 'w-10 h-10'} rounded-full mr-3`} />
          
          <View className="flex-1">
            <View className={`w-24 h-${isReply ? '3' : '4'} mb-1`} />
            
            <View className="w-full h-3 mb-1" />
            <View className="w-4/5 h-3 mb-1" />
            {!isReply && <View className="w-3/5 h-3 mb-2" />}
            
            <View className="w-20 h-2" />
          </View>
        </View>
        
        {replyCount > 0 && !isReply && (
          <View className="ml-10 mt-2">
            <View className="w-11/12 h-3 mb-1" />
            <View className="w-4/5 h-3" />
          </View>
        )}
      </AutoSkeletonView>
    </View>
  );
};