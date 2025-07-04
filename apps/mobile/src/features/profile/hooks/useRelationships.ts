import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { isFollowingAtom } from '../atoms/followingAtoms';
import type { FollowingState } from '../types/followingTypes';

export const useFollowUser = (userId: string) => {
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useAtom(isFollowingAtom(userId));

  return useMutation({
    mutationFn: async () => {
      const data = await graphqlFetch<{ followUser: any }>({
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });
};

export const useUnfollowUser = (userId: string) => {
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useAtom(isFollowingAtom(userId));

  return useMutation({
    mutationFn: async () => {
      const data = await graphqlFetch<{ unfollowUser: any }>({
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });
};

export const useFollowers = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey: ['followers', userId],
    queryFn: async () => {
      if (!userId) return [];

      const data = await graphqlFetch<{ followers: any[] }>({
        query: `
          query GetFollowers($userId: ID!) {
            followers(userId: $userId) {
              id
              userId
              username
              profileImage
              isFollowing
            }
          }
        `,
        variables: { userId },
      });
      return data.followers || [];
    },
    enabled: !!userId,
  });

  return result;
};

export const useFollowing = (userId: string | undefined) => {
  const result = useQuery({
    queryKey: ['following', userId],
    queryFn: async () => {
      if (!userId) return [];

      try {
        const data = await graphqlFetch<{ following: any[] }>({
          query: `
            query GetFollowing($userId: ID!) {
              following(userId: $userId) {
                id
                userId
                username
                profileImage
                isFollowing
              }
            }
          `,
          variables: { userId },
        });
        return data.following || [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!userId,
  });

  return result;
};

export const useSyncFollowingState = (userData: any[]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userData || !Array.isArray(userData)) return;

    const jotaiStore = queryClient.getQueryData(['jotai']) as FollowingState | undefined;
    const currentMap = jotaiStore?.followingMap || {};
    const newMap = { ...currentMap };

    let hasChanges = false;

    userData.forEach((user) => {
      if (user?.userId && user?.isFollowing !== undefined) {
        if (currentMap[user.userId] !== user.isFollowing) {
          newMap[user.userId] = user.isFollowing;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      queryClient.setQueryData<FollowingState>(['jotai'], {
        followingMap: newMap,
      });
    }
  }, [userData]);
};
