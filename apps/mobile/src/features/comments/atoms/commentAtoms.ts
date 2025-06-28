import { useAuthStore } from '@/features/auth/stores/authStore';
import { errorService } from '@/shared/services/errorService';
import { API_URL } from '@env';
import { atom } from 'jotai';
import { atomWithMutation, atomWithQuery } from 'jotai-tanstack-query';
import type { Comment } from '../types/commentTypes';

export const commentDrawerOpenAtom = atom(false);
export const currentPostIdAtom = atom<string | null>(null);
export const commentSortAtom = atom<'newest' | 'oldest'>('newest');
export const replyingToCommentAtom = atom<{ id: string; path: string; username?: string } | null>(
  null,
);
export const commentCursorAtom = atom<string | null>(null);
export const commentLimitAtom = atom(10);
export const refetchTriggerAtom = atom(0);

export const commentsQueryAtom = atomWithQuery((get) => {
  const postId = get(currentPostIdAtom);
  const sort = get(commentSortAtom);
  const cursor = get(commentCursorAtom);
  const limit = get(commentLimitAtom);
  const refetchTrigger = get(refetchTriggerAtom);

  return {
    queryKey: ['comments', postId, sort, cursor, limit, refetchTrigger],
    queryFn: async () => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        console.error('No auth token available for comments query');
        throw errorService.createError('No auth token available', 'auth/no-token');
      }
      if (!postId) {
        return { comments: [], totalCount: 0, hasNextPage: false };
      }

      try {
        const response = await fetch(`${API_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: `
              query GetComments($postId: ID!, $sort: CommentSortOption, $cursor: String, $limit: Int) {
                commentConnection(postId: $postId, parentId: null, sortBy: $sort, cursor: $cursor, limit: $limit) {
                  comments {
                    id
                    content
                    path
                    depth
                    parentId
                    createdAt
                    user {
                      id
                      username
                      profileImage
                    }
                  }
                  totalCount
                  hasNextPage
                  nextCursor
                }
              }
            `,
            variables: {
              postId,
              sort,
              cursor,
              limit,
            },
          }),
        });

        const data = await response.json();

        if (data.errors) {
          console.error('GraphQL errors:', data.errors);
          throw errorService.createError(
            data.errors[0].message || 'Failed to fetch comments',
            'server/graphql-error',
          );
        }

        return data.data?.commentConnection;
      } catch (error) {
        throw errorService.createError(
          'Unable to load comments',
          'network/fetch-failed',
          error instanceof Error ? error : undefined,
        );
      }
    },
    enabled: !!postId,
  };
});

export const optimisticCommentsAtom = atom<Comment[]>([]);

export const combinedCommentsAtom = atom((get) => {
  const queryResult = get(commentsQueryAtom);
  const optimisticComments = get(optimisticCommentsAtom);

  if (!queryResult.data) {
    return optimisticComments;
  }

  const serverComments = queryResult.data.comments || [];

  const filteredOptimistic = optimisticComments.filter(
    (optimistic) => !serverComments.some((server: { id: string }) => server.id === optimistic.id),
  );

  return [...filteredOptimistic, ...serverComments];
});

export const createCommentMutationAtom = atomWithMutation(() => {
  return {
    mutationKey: ['createComment'],
    mutationFn: async ({
      postId,
      content,
      parentId = null,
    }: {
      postId: string;
      content: string;
      parentId?: string | null;
    }) => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw errorService.createError('No auth token available', 'auth/no-token');
      }

      // Create the request body
      const requestBody = JSON.stringify({
        query: `
          mutation CreateComment($input: CommentInput!) {
            createComment(input: $input) {
              id
              content
              path
              depth
              parentId
              createdAt
              user {
                id
                username
                profileImage
              }
            }
          }
        `,
        variables: {
          input: {
            postId,
            content,
            parentId: parentId || null,
          },
        },
      });

      try {
        const response = await fetch(`${API_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: requestBody,
        });

        const data = await response.json();

        if (data.errors) {
          console.error('GraphQL error details:', data.errors);
          throw errorService.createError(
            data.errors[0].message || 'Failed to create comment',
            'server/graphql-error',
          );
        }

        return data.data.createComment;
      } catch (error) {
        console.error('Comment creation network error:', error);
        // If it's a fetch network error
        if (error instanceof Error) {
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }

        throw errorService.createError(
          error instanceof Error ? error.message : 'Unable to post comment',
          'network/post-failed',
          error instanceof Error ? error : undefined,
        );
      }
    },
  };
});

export const deleteCommentMutationAtom = atomWithMutation(() => {
  return {
    mutationKey: ['deleteComment'],
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw errorService.createError('No auth token available', 'auth/no-token');
      }

      try {
        const response = await fetch(`${API_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: `
              mutation DeleteComment($id: ID!) {
                deleteComment(id: $id) {
                  id
                  success
                }
              }
            `,
            variables: {
              id: commentId,
            },
          }),
        });

        const data = await response.json();

        if (data.errors) {
          throw errorService.createError(
            data.errors[0].message || 'Failed to delete comment',
            'server/graphql-error',
          );
        }

        return { ...data.data.deleteComment, postId };
      } catch (error) {
        throw errorService.createError(
          'Unable to delete comment',
          'network/delete-failed',
          error instanceof Error ? error : undefined,
        );
      }
    },
  };
});

export const loadMoreCommentsAtom = atom(null, (get, set) => {
  const queryResult = get(commentsQueryAtom);

  if (queryResult.data?.hasNextPage && queryResult.data?.nextCursor) {
    set(commentCursorAtom, queryResult.data.nextCursor);
  }
});
