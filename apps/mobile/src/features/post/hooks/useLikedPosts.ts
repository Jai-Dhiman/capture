import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { STALE_TIMES } from '@/shared/lib/queryConfig';
import { useQuery } from '@tanstack/react-query';

export const useLikedPosts = (limit = 10, offset = 0) => {
  return useQuery({
    queryKey: [...queryKeys.likedPosts(), limit, offset],
    queryFn: async () => {
      const data = await graphqlFetch<{ likedPosts: any[] }>({
        query: `
          query GetLikedPosts($limit: Int, $offset: Int) {
            likedPosts(limit: $limit, offset: $offset) {
              id
              content
              type
              createdAt
              user { id username profileImage }
              media { id storageKey type order }
              hashtags { id name }
              isSaved
              isLiked
              _commentCount
              _likeCount
            }
          }
        `,
        variables: { limit, offset },
      });
      return data.likedPosts || [];
    },
    staleTime: STALE_TIMES.PROFILE,
  });
};
