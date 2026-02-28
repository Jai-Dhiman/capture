import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useLikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const data = await graphqlFetch<{ likePost: any }>({
        query: `
          mutation LikePost($postId: ID!) {
            likePost(postId: $postId) {
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

      return data.likePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likedPosts() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
    onError: (error) => {
      console.error('Like mutation failed:', error.message);
    },
  });
};

export const useUnlikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const data = await graphqlFetch<{ unlikePost: any }>({
        query: `
          mutation UnlikePost($postId: ID!) {
            unlikePost(postId: $postId) {
              success
            }
          }
        `,
        variables: {
          postId,
        },
      });

      return data.unlikePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likedPosts() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
    onError: (error) => {
      console.error('Like mutation failed:', error.message);
    },
  });
};