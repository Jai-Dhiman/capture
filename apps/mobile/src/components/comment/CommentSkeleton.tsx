import React from 'react';
import { View } from 'react-native';
import { SkeletonElement } from '../ui/SkeletonLoader';

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
      <View className="flex-row items-start">
        <SkeletonElement 
          width={isReply ? 32 : 40} 
          height={isReply ? 32 : 40} 
          radius="round" 
        />
        
        <View className="flex-1 ml-3">
          <SkeletonElement width={96} height={isReply ? 12 : 16} />
          
          <SkeletonElement width="100%" height={12} />
          <SkeletonElement width="80%" height={12} />
          {!isReply && <SkeletonElement width="60%" height={12} />}
          
          <SkeletonElement width={80} height={8} />
        </View>
      </View>
      
      {replyCount > 0 && !isReply && (
        <View className="ml-10 mt-2">
          <SkeletonElement width="92%" height={12} />
          <SkeletonElement width="80%" height={12} />
        </View>
      )}
    </View>
  );
};