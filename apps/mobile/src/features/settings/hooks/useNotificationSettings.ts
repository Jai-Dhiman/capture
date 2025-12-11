import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface NotificationSettings {
  id: string;
  enablePush: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
  saves: boolean;
  updatedAt: string;
}

export interface NotificationSettingsInput {
  enablePush?: boolean;
  likes?: boolean;
  comments?: boolean;
  follows?: boolean;
  mentions?: boolean;
  saves?: boolean;
}

export const useNotificationSettings = () => {
  return useQuery({
    queryKey: ['notificationSettings'],
    queryFn: async () => {
      const data = await graphqlFetch<{ notificationSettings: NotificationSettings }>({
        query: `
          query GetNotificationSettings {
            notificationSettings {
              id
              enablePush
              likes
              comments
              follows
              mentions
              saves
              updatedAt
            }
          }
        `,
      });
      return data.notificationSettings;
    },
  });
};

export const useUpdateNotificationSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NotificationSettingsInput) => {
      const data = await graphqlFetch<{ updateNotificationSettings: NotificationSettings }>({
        query: `
          mutation UpdateNotificationSettings($input: NotificationSettingsInput!) {
            updateNotificationSettings(input: $input) {
              id
              enablePush
              likes
              comments
              follows
              mentions
              saves
              updatedAt
            }
          }
        `,
        variables: { input },
      });
      return data.updateNotificationSettings;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['notificationSettings'] });

      const previousSettings = queryClient.getQueryData<NotificationSettings>([
        'notificationSettings',
      ]);

      if (previousSettings) {
        queryClient.setQueryData<NotificationSettings>(['notificationSettings'], {
          ...previousSettings,
          ...input,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousSettings };
    },
    onError: (_err, _input, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['notificationSettings'], context.previousSettings);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
    },
  });
};
