import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { isFollowingAtom } from '../atoms/followingAtoms';

export const useFollowUser = (userId: string) => {
  const queryClient = useQueryClient();
  const [_isFollowing, setIsFollowing] = useAtom(isFollowingAtom(userId));

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
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
  });
};

export const useUnfollowUser = (userId: string) => {
  const queryClient = useQueryClient();
  const [_isFollowing, setIsFollowing] = useAtom(isFollowingAtom(userId));

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
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
  });
};

export const useFollowers = (userId: string | undefined) => {
  const _queryClient = useQueryClient();

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
        console.error('Failed to fetch following:', error);
        throw error;
      }
    },
    enabled: !!userId,
  });

  return result;
};

