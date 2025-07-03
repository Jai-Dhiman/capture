import type { Post } from '@/features/post/types/postTypes';
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { type QueryFunctionContext, useInfiniteQuery } from '@tanstack/react-query';

interface DiscoverFeedResponse {
  posts: Post[];
  nextCursor: string | null;
}

export const useDiscoverFeed = (limit = 10) => {
  return useInfiniteQuery<DiscoverFeedResponse, Error>({
    queryKey: ['discoverFeed'],
    queryFn: async ({ pageParam: cursor }: QueryFunctionContext) => {
      const data = await graphqlFetch<{ discoverFeed: DiscoverFeedResponse }>({
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
      });

      return data.discoverFeed;
    },
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,
    retry: 1,
  });
};
