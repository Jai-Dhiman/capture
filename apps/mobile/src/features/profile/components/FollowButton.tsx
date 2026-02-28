import type { FollowingState } from '@/features/profile/types/followingTypes';
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean | null;
  className?: string;
}

export const FollowButton = ({
  userId,
  isFollowing: initialIsFollowing,
  className = '',
}: FollowButtonProps) => {
  const [isFollowing, setIsFollowing] = useState<boolean | null>(initialIsFollowing);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialIsFollowing !== null && initialIsFollowing !== isFollowing) {
      setIsFollowing(initialIsFollowing);

      const jotaiStore = queryClient.getQueryData(['jotai']) as FollowingState | undefined;
      const followingMap = { ...(jotaiStore?.followingMap || {}) };

      if (followingMap[userId] !== initialIsFollowing) {
        followingMap[userId] = initialIsFollowing;
        queryClient.setQueryData<FollowingState>(['jotai'], {
          followingMap,
        });
      }
    }
  }, [initialIsFollowing, userId]);

  const followMutation = useMutation({
    mutationFn: async () => {
      const data = await graphqlFetch<{
        followUser: {
          success: boolean;
          relationship: { id: string; followerId: string; followedId: string; createdAt: string };
        };
      }>({
        query: `
          mutation FollowUser($userId: ID!) {
            followUser(userId: $userId) {
              success
              relationship {
                id
                followerId
                followedId
                createdAt
              }
            }
          }
        `,
        variables: { userId },
      });

      return data.followUser;
    },
    onMutate: () => {
      setIsFollowing(true);
    },
    onError: () => {
      setIsFollowing(false);
    },
    onSuccess: () => {
      setIsFollowing(true);

      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const data = await graphqlFetch<{
        unfollowUser: { success: boolean };
      }>({
        query: `
          mutation UnfollowUser($userId: ID!) {
            unfollowUser(userId: $userId) {
              success
            }
          }
        `,
        variables: { userId },
      });

      return data.unfollowUser;
    },
    onMutate: () => {
      setIsFollowing(false);
    },
    onError: () => {
      setIsFollowing(true);
    },
    onSuccess: () => {
      setIsFollowing(false);

      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  const isPending = followMutation.isPending || unfollowMutation.isPending;

  const handlePress = () => {
    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  if (isFollowing === null) {
    return (
      <TouchableOpacity
        className={`py-2 px-4 bg-gray-100 rounded-[30px] ${className}`}
        disabled={true}
      >
        <ActivityIndicator size="small" color="#000" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      className={`py-1 px-4 bg-[#E4CAC7] rounded-[30px] ${className}`}
      onPress={handlePress}
      disabled={isPending}
    >
      {isPending ? (
        <ActivityIndicator size="small" color="#000" />
      ) : (
        <Text className="text-center font-semibold text-xs">
          {isFollowing ? 'Unfollow' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
};
