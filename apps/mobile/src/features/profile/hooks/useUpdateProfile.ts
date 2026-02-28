import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ProfileInput {
  username?: string;
  bio?: string;
  profileImage?: string;
  isPrivate?: boolean;
}

export const useUpdateProfile = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      const data = await graphqlFetch<{ updateProfile: any }>({
        query: `
          mutation UpdateProfile($input: ProfileInput!) {
            updateProfile(input: $input) {
              id
              userId
              username
              bio
              profileImage
              isPrivate
              followersCount
              followingCount
            }
          }
        `,
        variables: { input },
      });
      return data.updateProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
    onError: (error) => {
      console.error('Update profile failed:', error.message);
    },
  });
};
