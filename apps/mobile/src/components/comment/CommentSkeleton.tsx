import React from 'react';
import { View } from 'react-native';
import SkeletonContent from 'react-native-skeleton-content';

interface CommentSkeletonProps {
  isReply?: boolean;
  replyCount?: number;
}

export const CommentSkeleton: React.FC<CommentSkeletonProps> = ({ 
  isReply = false,
  replyCount = 0
}) => {
  const layoutWithReplies = [
    // Avatar
    { width: 32, height: 32, borderRadius: 16, marginRight: 12 },
    // Comment container
    {
      width: '85%',
      children: [
        // Username
        { width: 100, height: 15, marginBottom: 6 },
        // Content lines
        { width: '100%', height: 12, marginBottom: 4 },
        { width: '80%', height: 12, marginBottom: 4 },
        { width: '60%', height: 12, marginBottom: 8 },
        // Date and actions
        { width: 80, height: 10 }
      ]
    },
    ...(replyCount > 0 && !isReply ? [
      {
        width: '80%',
        marginLeft: 44,
        children: [
          // Reply content
          { width: '90%', height: 12, marginBottom: 4 },
          { width: '70%', height: 12, marginBottom: 4 },
        ]
      }
    ] : [])
  ];

  const replyLayout = [
    // Avatar
    { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
    // Comment container
    {
      width: '75%',
      children: [
        // Username
        { width: 80, height: 12, marginBottom: 4 },
        // Content lines
        { width: '100%', height: 10, marginBottom: 3 },
        { width: '60%', height: 10, marginBottom: 6 },
        // Date
        { width: 60, height: 8 }
      ]
    }
  ];

  return (
    <View className={`mb-3 ${isReply ? 'ml-8' : ''}`}>
      <SkeletonContent
        containerStyle={{ flexDirection: 'row', alignItems: 'flex-start' }}
        isLoading={true}
        animationDirection="horizontalLeft"
        boneColor="#EFEFEF"
        highlightColor="#F7F7F7"
      />
    </View>
  );
};