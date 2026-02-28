import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { STALE_TIMES } from '@/shared/lib/queryConfig';
import { type QueryFunctionContext, useInfiniteQuery } from '@tanstack/react-query';
import type { Post } from '@/features/post/types/postTypes';
import { useSessionTracking } from './useSessionTracking';

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
  const { sessionId, isNewSession } = useSessionTracking();

  return useInfiniteQuery<DiscoveryResult, Error>({
    queryKey: ['discoverFeed'],
    queryFn: async ({ pageParam: cursor }: QueryFunctionContext) => {
      const data = await graphqlFetch<{ discoverFeed: DiscoveryResult }>({
        query: `
          query GetDiscoverFeed($limit: Int, $cursor: String, $sessionId: String, $isNewSession: Boolean) {
            discoverFeed(limit: $limit, cursor: $cursor, sessionId: $sessionId, isNewSession: $isNewSession) {
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
                _likeCount
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
        variables: { limit, cursor, sessionId, isNewSession },
      });

      return data.discoverFeed;
    },
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.FEED,
    retry: 1,
  });
};
