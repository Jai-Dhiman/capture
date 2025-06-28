import { useAuthStore } from '@/features/auth/stores/authStore';
import { API_URL } from '@env';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useSavedPosts = (limit = 10, offset = 0) => {
  return useQuery({
    queryKey: ['savedPosts', limit, offset],
    queryFn: async () => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
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
        }),
      });

      const data = await response.json();

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
        throw new Error(data.errors[0].message);
      }

      return data.data.savedPosts || [];
    },
  });
};

export const useSavePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
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
        }),
      });

      const data = await response.json();

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
        throw new Error(data.errors[0].message || 'Unknown GraphQL error');
      }

      return data.data.savePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};

export const useUnsavePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
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
        }),
      });

      const data = await response.json();

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
        throw new Error(data.errors[0].message || 'Unknown GraphQL error');
      }

      return data.data.unsavePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
