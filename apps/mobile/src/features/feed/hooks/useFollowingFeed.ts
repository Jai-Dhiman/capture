import type { Post } from '@/features/post/types/postTypes';
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { STALE_TIMES } from '@/shared/lib/queryConfig';
import { type QueryFunctionContext, useInfiniteQuery } from '@tanstack/react-query';

interface FollowingFeedResult {
  posts: Post[];
  hasMore: boolean;
  nextCursor?: string;
}

export const useFollowingFeed = (limit = 10) => {
  return useInfiniteQuery<FollowingFeedResult, Error>({
    queryKey: ['followingFeed'],
    queryFn: async ({ pageParam: cursor }: QueryFunctionContext) => {
      const data = await graphqlFetch<{ followingFeed: FollowingFeedResult }>({
        query: `
          query GetFollowingFeed($limit: Int, $cursor: String) {
            followingFeed(limit: $limit, cursor: $cursor) {
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
            }
          }
        `,
        variables: { limit, cursor },
      });

      return data.followingFeed;
    },
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.FEED,
    retry: 1,
  });
};
