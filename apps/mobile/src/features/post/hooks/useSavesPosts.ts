import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useSavedPosts = (limit = 10, offset = 0) => {
  return useQuery({
    queryKey: ['savedPosts', limit, offset],
    queryFn: async () => {
      const data = await graphqlFetch<{ savedPosts: any[] }>({
        query: `
          query GetSavedPosts($limit: Int, $offset: Int) {
            savedPosts(limit: $limit, offset: $offset) {
              id
              content
              type
              createdAt
              user {
                id
                username
                profileImage
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
            }
          }
        `,
        variables: {
          limit,
          offset,
        },
      });

      return data.savedPosts || [];
    },
  });
};

export const useSavePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const data = await graphqlFetch<{ savePost: any }>({
        query: `
          mutation SavePost($postId: ID!) {
            savePost(postId: $postId) {
              success
              post {
                id
              }
            }
          }
        `,
        variables: {
          postId,
        },
      });

      return data.savePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedPosts() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
  });
};

export const useUnsavePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const data = await graphqlFetch<{ unsavePost: any }>({
        query: `
          mutation UnsavePost($postId: ID!) {
            unsavePost(postId: $postId) {
              success
            }
          }
        `,
        variables: {
          postId,
        },
      });

      return data.unsavePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedPosts() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
  });
};
