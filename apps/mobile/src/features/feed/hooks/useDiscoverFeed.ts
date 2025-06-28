import { useAuthStore } from '@/features/auth/stores/authStore';
import type { Post } from '@/features/post/types/postTypes';
import { API_URL } from '@env';
import { type QueryFunctionContext, useInfiniteQuery } from '@tanstack/react-query';

interface DiscoverFeedResponse {
  posts: Post[];
  nextCursor: string | null;
}

export const useDiscoverFeed = (limit = 10) => {
  const { session } = useAuthStore();

  return useInfiniteQuery<DiscoverFeedResponse, Error>({
    queryKey: ['discoverFeed'],
    queryFn: async ({ pageParam: cursor }: QueryFunctionContext) => {
      if (!session?.access_token) {
        throw new Error('No auth token available');
      }
      const res = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query: `
            query GetDiscoverFeed($limit: Int, $cursor: String) {
              discoverFeed(limit: $limit, cursor: $cursor) {
                posts {
                  id
                  userId
                  content
                  type
                  createdAt
                  updatedAt
                  user {
                    id
                    userId
                    username
                    profileImage
                    isBlocked
                  }
                  media {
                    id
                    storageKey
                    type
                    order
                  }
                  hashtags {
                    id
                    name
                  }
                  isSaved
                  _commentCount
                  _saveCount
                }
                nextCursor
              }
            }
          `,
          variables: { limit, cursor },
        }),
      });
      const { data, errors } = await res.json();
      if (errors) throw new Error(errors[0].message);
      return data.discoverFeed as DiscoverFeedResponse;
    },
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,
    retry: 1,
  });
};
