import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useFollowUser, useUnfollowUser } from '../../hooks/useRelationships';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean | null;
  className?: string;
}

export const FollowButton = ({ userId, isFollowing, className = '' }: FollowButtonProps) => {
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  
  const isLoading = followMutation.isPending || unfollowMutation.isPending;
  
  if (isFollowing === null) {
    return null;
  }
  
  const handlePress = () => {
    if (isFollowing) {
      unfollowMutation.mutate(userId);
    } else {
      followMutation.mutate(userId);
    }
  };
  
  return (
    <TouchableOpacity
      className={`py-2 px-4 ${isFollowing ? 'bg-gray-200' : 'bg-[#E4CAC7]'} ${className}`}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#000" />
      ) : (
        <Text className="text-center font-semibold">
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
};