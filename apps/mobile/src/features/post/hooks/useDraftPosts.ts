import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { STALE_TIMES } from '@/shared/lib/queryConfig';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useDraftPosts = (limit = 10, offset = 0) => {
  return useQuery({
    queryKey: [...queryKeys.draftPosts(), limit, offset],
    queryFn: async () => {
      const data = await graphqlFetch<{ draftPosts: any[] }>({
        query: `
          query GetDraftPosts($limit: Int, $offset: Int) {
            draftPosts(limit: $limit, offset: $offset) {
              id
              content
              type
              createdAt
              updatedAt
              media { id storageKey type order }
              hashtags { id name }
            }
          }
        `,
        variables: { limit, offset },
      });
      return data.draftPosts || [];
    },
    staleTime: STALE_TIMES.PROFILE,
  });
};

export const useSaveDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { content: string; type: 'post' | 'thread'; mediaIds?: string[]; hashtagIds?: string[] }) => {
      const data = await graphqlFetch<{ saveDraftPost: any }>({
        query: `
          mutation SaveDraft($input: PostInput!) {
            saveDraftPost(input: $input) {
              id
              content
              type
              createdAt
            }
          }
        `,
        variables: { input },
      });
      return data.saveDraftPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.draftPosts() });
    },
    onError: (error) => {
      console.error('Save draft failed:', error.message);
    },
  });
};

export const usePublishDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      const data = await graphqlFetch<{ publishDraftPost: any }>({
        query: `
          mutation PublishDraft($id: ID!) {
            publishDraftPost(id: $id) {
              id
              content
              type
              createdAt
            }
          }
        `,
        variables: { id: draftId },
      });
      return data.publishDraftPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.draftPosts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
    onError: (error) => {
      console.error('Publish draft failed:', error.message);
    },
  });
};

export const useDeleteDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      const data = await graphqlFetch<{ deleteDraftPost: any }>({
        query: `
          mutation DeleteDraft($id: ID!) {
            deleteDraftPost(id: $id) {
              id
              success
            }
          }
        `,
        variables: { id: draftId },
      });
      return data.deleteDraftPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.draftPosts() });
    },
    onError: (error) => {
      console.error('Delete draft failed:', error.message);
    },
  });
};
