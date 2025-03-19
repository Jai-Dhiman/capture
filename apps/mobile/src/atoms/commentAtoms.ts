import { atom } from 'jotai'
import { atomWithQuery, atomWithMutation } from 'jotai-tanstack-query'
import { useAuthStore } from 'stores/authStore'
import { Comment } from '../types/commentTypes'
import { API_URL } from '@env'
import { errorService } from '../services/errorService'

export const commentDrawerOpenAtom = atom(false)
export const currentPostIdAtom = atom<string | null>(null)
export const commentSortAtom = atom<'newest' | 'oldest'>('newest')
export const replyingToCommentAtom = atom<{ id: string; username?: string; path?: string } | null>(
  null
)
export const commentCursorAtom = atom<string | null>(null)
export const commentLimitAtom = atom(10)

export const commentsQueryAtom = atomWithQuery((get) => {
  const postId = get(currentPostIdAtom)
  const sort = get(commentSortAtom)
  const cursor = get(commentCursorAtom)
  const limit = get(commentLimitAtom)

  return {
    queryKey: ['comments', postId, sort, cursor, limit],
    queryFn: async ({ queryKey }) => {
      const { session } = useAuthStore.getState()

      if (!session?.access_token) {
        throw errorService.createError('No auth token available', 'auth/no-token')
      }
      if (!postId) return { comments: [], totalCount: 0, hasNextPage: false }

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
                commentConnection(postId: $postId, sortBy: $sort, cursor: $cursor, limit: $limit) {
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
            variables: { postId, sort, cursor, limit },
          }),
        })

        const data = await response.json()

        if (data.errors) {
          throw errorService.createError(
            data.errors[0].message || 'Failed to fetch comments',
            'server/graphql-error'
          )
        }

        return data.data.commentConnection
      } catch (error) {
        throw errorService.createError(
          'Unable to load comments',
          'network/fetch-failed',
          error instanceof Error ? error : undefined
        )
      }
    },
    enabled: !!postId,
  }
})

export const optimisticCommentsAtom = atom<Comment[]>([])

export const combinedCommentsAtom = atom((get) => {
  const queryResult = get(commentsQueryAtom)
  const optimisticComments = get(optimisticCommentsAtom)

  if (!queryResult.data) return optimisticComments

  const serverComments = queryResult.data.comments || []

  const filteredOptimistic = optimisticComments.filter(
    (optimistic) => !serverComments.some((server: { id: string }) => server.id === optimistic.id)
  )

  return [...serverComments, ...filteredOptimistic]
})

export const createCommentMutationAtom = atomWithMutation((get) => {
  return {
    mutationKey: ['createComment'],
    mutationFn: async ({
      postId,
      content,
      parentId = null,
    }: {
      postId: string
      content: string
      parentId?: string | null
    }) => {
      const { session } = useAuthStore.getState()

      if (!session?.access_token) {
        throw errorService.createError('No auth token available', 'auth/no-token')
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
                parentId,
              },
            },
          }),
        })

        const data = await response.json()

        if (data.errors) {
          throw errorService.createError(
            data.errors[0].message || 'Failed to create comment',
            'server/graphql-error'
          )
        }

        return data.data.createComment
      } catch (error) {
        throw errorService.createError(
          'Unable to post comment',
          'network/post-failed',
          error instanceof Error ? error : undefined
        )
      }
    },
  }
})

export const deleteCommentMutationAtom = atomWithMutation(() => {
  return {
    mutationKey: ['deleteComment'],
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      const { session } = useAuthStore.getState()

      if (!session?.access_token) {
        throw errorService.createError('No auth token available', 'auth/no-token')
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
        })

        const data = await response.json()

        if (data.errors) {
          throw errorService.createError(
            data.errors[0].message || 'Failed to delete comment',
            'server/graphql-error'
          )
        }

        return { ...data.data.deleteComment, postId }
      } catch (error) {
        throw errorService.createError(
          'Unable to delete comment',
          'network/delete-failed',
          error instanceof Error ? error : undefined
        )
      }
    },
  }
})

export const loadMoreCommentsAtom = atom(null, (get, set) => {
  const queryResult = get(commentsQueryAtom)

  if (queryResult.data?.hasNextPage && queryResult.data?.nextCursor) {
    set(commentCursorAtom, queryResult.data.nextCursor)
  }
})
