import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { type QueryFunctionContext, useInfiniteQuery } from '@tanstack/react-query';
import type { Post } from '@/features/post/types/postTypes';

interface DiscoveryResult {
  posts: Post[];
  hasMore: boolean;
  nextCursor?: string;
  metrics?: {
    processingTimeMs: number;
    candidatesEvaluated: number;
    wasmOperationsUsed: string[];
    fallbacksUsed: string[];
    cacheHitRate: number;
    algorithmVersion: string;
  };
}

export const useDiscoverFeed = (limit = 10) => {
  return useInfiniteQuery<DiscoveryResult, Error>({
    queryKey: ['discoverFeed'],
    queryFn: async ({ pageParam: cursor }: QueryFunctionContext) => {
      const data = await graphqlFetch<{ discoverFeed: DiscoveryResult }>({
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
                isSaved
                user {
                  id
                  userId
                  username
                  profileImage
                  bio
                  verifiedType
                  followersCount
                  followingCount
                  isFollowing
                  createdAt
                  updatedAt
                }
                media {
                  id
                  type
                  storageKey
                  order
                  createdAt
                }
                hashtags {
                  id
                  name
                  createdAt
                }
                _commentCount
                _saveCount
              }
              hasMore
              nextCursor
              metrics {
                processingTimeMs
                candidatesEvaluated
                wasmOperationsUsed
                fallbacksUsed
                cacheHitRate
                algorithmVersion
              }
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
