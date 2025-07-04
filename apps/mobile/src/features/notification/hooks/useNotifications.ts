import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export const useNotifications = (limit = 20, offset = 0, includeRead = false) => {
  const queryClient = useQueryClient();

  // Set up AppState listener to refresh when app becomes active
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['notifications', limit, offset, includeRead],
    queryFn: async () => {
      try {
        const data = await graphqlFetch<{ notifications: any[] }>({
          query: `
            query GetNotifications($limit: Int, $offset: Int, $includeRead: Boolean) {
              notifications(limit: $limit, offset: $offset, includeRead: $includeRead) {
                id
                type
                message
                isRead
                createdAt
                actionUser {
                  userId
                  username
                  profileImage
                }
                resourceId
                resourceType
              }
            }
          `,
          variables: { limit, offset, includeRead },
        });
        return data.notifications || [];
      } catch (error) {
        console.error(error);
        return [];
      }
    },
  });
};

export const useUnreadNotificationCount = () => {
  const queryClient = useQueryClient();

  // Set up AppState listener to refresh when app becomes active
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['unreadNotificationCount'],
    queryFn: async () => {
      try {
        const data = await graphqlFetch<{ unreadNotificationCount: number }>({
          query: `
            query GetUnreadNotificationCount {
              unreadNotificationCount
            }
          `,
        });
        return data.unreadNotificationCount || 0;
      } catch (error) {
        return 0;
      }
    },
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const data = await graphqlFetch<{ markNotificationRead: any }>({
        query: `
          mutation MarkNotificationRead($id: ID!) {
            markNotificationRead(id: $id) {
              success
            }
          }
        `,
        variables: { id },
      });
      return data.markNotificationRead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await graphqlFetch<{ markAllNotificationsRead: any }>({
        query: `
          mutation MarkAllNotificationsRead {
            markAllNotificationsRead {
              success
              count
            }
          }
        `,
      });
      return data.markAllNotificationsRead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
    },
  });
};
