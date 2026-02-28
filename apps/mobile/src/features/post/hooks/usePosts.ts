import { useAuthStore } from '@/features/auth/stores/authStore';
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useUserPosts = (userId?: string) => {
  return useQuery({
    queryKey: ['userPosts', userId],
    queryFn: async () => {
      const data = await graphqlFetch<{ profile: { posts: any[] } }>({
        query: `
          query GetUserPosts($userId: ID!) {
            profile(id: $userId) {
              id
              posts {
                id
                content
                type
                createdAt
                isSaved
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
              }
            }
          }
        `,
        variables: { userId },
      });

      return data.profile?.posts || [];
    },
    enabled: !!userId,
  });
};

export const useSinglePost = (postId?: string) => {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const data = await graphqlFetch<{ post: any }>({
        query: `
          query GetPost($postId: ID!) {
            post(id: $postId) {
              id
              content
              type
              createdAt
              userId
              isSaved
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
              comments {
                id
              }
              _commentCount
            }
          }
        `,
        variables: {
          postId,
        },
      });

      return data.post;
    },
    enabled: !!postId,
  });
};

export const useCreatePost = () => {
  return useMutation({
    mutationFn: async ({
      content,
      type = 'post',
      mediaIds,
      hashtagIds,
    }: {
      content: string;
      type: 'post' | 'thread';
      mediaIds: string[];
      hashtagIds?: string[];
    }) => {
      const data = await graphqlFetch<{ createPost: any }>({
        query: `
          mutation CreatePost($input: PostInput!) {
            createPost(input: $input) {
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
            }
          }
        `,
        variables: {
          input: {
            content,
            type,
            mediaIds,
            hashtagIds,
          },
        },
      });

      return data.createPost;
    },
    onError: (error) => {
      console.error('Create post failed:', error.message);
    },
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const data = await graphqlFetch<{ deletePost: any }>({
        query: `
          mutation DeletePost($id: ID!) {
            deletePost(id: $id) {
              id
              success
            }
          }
        `,
        variables: {
          id: postId,
        },
      });

      return data.deletePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.savedPosts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.likedPosts() });
    },
  });
};

export const useMarkPostsAsSeen = () => {
  return useMutation({
    mutationFn: async (postIds: string[]) => {
      if (postIds.length === 0) {
        return { success: true };
      }
      try {
        const data = await graphqlFetch<{ markPostsAsSeen: any }>({
          query: `
            mutation MarkPostsAsSeen($postIds: [ID!]!) {
              markPostsAsSeen(postIds: $postIds) {
                success
              }
            }
          `,
          variables: {
            postIds,
          },
        });
        return data.markPostsAsSeen;
      } catch (error) {
        console.error('GraphQL Errors marking posts as seen:', error);
        return { success: false };
      }
    },
    onError: (error) => {
      console.error('Error marking posts as seen:', error);
    },
  });
};
