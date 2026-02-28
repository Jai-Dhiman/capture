import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { errorService } from '@/shared/services/errorService';
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

export const commentsQueryAtom = atomWithQuery((get) => {
  const postId = get(currentPostIdAtom);
  const sort = get(commentSortAtom);
  const cursor = get(commentCursorAtom);
  const limit = get(commentLimitAtom);

  return {
    queryKey: ['comments', postId, sort, cursor, limit],
    queryFn: async () => {
      if (!postId) {
        return { comments: [], totalCount: 0, hasNextPage: false, nextCursor: null };
      }

      try {
        const data = await graphqlFetch<{
          commentConnection: {
            comments: Comment[];
            totalCount: number;
            hasNextPage: boolean;
            nextCursor: string | null;
          };
        }>({
          query: `
            query GetComments($postId: ID!, $sort: CommentSortOption, $cursor: String, $limit: Int) {
              commentConnection(postId: $postId, parentId: null, sortBy: $sort, cursor: $cursor, limit: $limit) {
                comments {
                  id
                  content
                  path
                  depth
                  parentId
                  isDeleted
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
        });

        return data.commentConnection;
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
      try {
        const data = await graphqlFetch<{
          createComment: Comment;
        }>({
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

        return data.createComment;
      } catch (error) {
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
      try {
        const data = await graphqlFetch<{
          deleteComment: { id: string; success: boolean };
        }>({
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
        });

        return { ...data.deleteComment, postId };
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
