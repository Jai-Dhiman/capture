import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UpdatePostInput {
  content: string;
  type: 'post' | 'thread';
  mediaIds?: string[];
  hashtagIds?: string[];
}

export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePostInput }) => {
      const data = await graphqlFetch<{ updatePost: any }>({
        query: `
          mutation UpdatePost($id: ID!, $input: PostInput!) {
            updatePost(id: $id, input: $input) {
              id
              content
              type
              createdAt
              updatedAt
              user { id username profileImage }
              media { id storageKey type order }
              hashtags { id name }
            }
          }
        `,
        variables: { id, input },
      });
      return data.updatePost;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.post(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
    onError: (error) => {
      console.error('Update post failed:', error.message);
    },
  });
};
