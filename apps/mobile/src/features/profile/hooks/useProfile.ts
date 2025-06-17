import { useAuthStore } from '@/features/auth/stores/authStore';
import { API_URL } from '@env';
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

      const { session } = useAuthStore.getState();
      if (!session?.access_token) return null;

      const response = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
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
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      if (data.errors) {
        if (data.errors.some((e: any) => e.message === 'Profile not found')) {
          return null;
        }
        throw new Error(data.errors[0]?.message || 'Failed to fetch profile');
      }
      return {
        ...data.data.profile,
        username: data.data.profile.username || 'User',
        profileImage: data.data.profile.profileImage || null,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}
