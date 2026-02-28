import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useBlockUser = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await graphqlFetch<{ blockUser: any }>({
        query: `
          mutation BlockUser($userId: ID!) {
            blockUser(userId: $userId) {
              success
              blockedUser {
                id
                username
              }
            }
          }
        `,
        variables: { userId },
      });
      return data.blockUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: (error) => {
      console.error('Block mutation failed:', error.message);
    },
  });
};

export const useUnblockUser = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await graphqlFetch<{ unblockUser: any }>({
        query: `
          mutation UnblockUser($userId: ID!) {
            unblockUser(userId: $userId) {
              success
            }
          }
        `,
        variables: { userId },
      });
      return data.unblockUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: (error) => {
      console.error('Block mutation failed:', error.message);
    },
  });
};

export const useBlockedUsers = () => {
  return useQuery({
    queryKey: ['blockedUsers'],
    queryFn: async () => {
      const data = await graphqlFetch<{ blockedUsers: any[] }>({
        query: `
          query GetBlockedUsers {
            blockedUsers {
              id
              userId
              username
              profileImage
              createdAt
            }
          }
        `,
      });
      return data.blockedUsers || [];
    },
  });
};
