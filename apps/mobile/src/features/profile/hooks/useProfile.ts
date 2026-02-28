import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { STALE_TIMES } from '@/shared/lib/queryConfig';
import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import type { UserProfile } from '../stores/profileStore';

export function useProfile(
  userId?: string,
  options?: Omit<UseQueryOptions<UserProfile | null>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<UserProfile | null>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      try {
        const data = await graphqlFetch<{
          profile: UserProfile;
        }>({
          query: `
            query GetProfile($userId: ID!) {
              profile(id: $userId) {
                id
                userId
                username
                bio
                profileImage
                followersCount
                followingCount
                isFollowing
                isPrivate
              }
            }
          `,
          variables: { userId },
        });

        return {
          ...data.profile,
          username: data.profile.username || 'User',
          profileImage: data.profile.profileImage || undefined,
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'Profile not found') {
          return null;
        }
        throw error;
      }
    },
    enabled: !!userId,
    staleTime: STALE_TIMES.PROFILE,
    ...options,
  });
}
