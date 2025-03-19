import { atom } from 'jotai'
import { atomWithQuery, atomWithMutation } from 'jotai-tanstack-query'
import { useAuthStore } from 'stores/authStore'
import { Comment } from '../types/commentTypes'
import { API_URL } from '@env'

export const commentDrawerOpenAtom = atom(false)
export const currentPostIdAtom = atom<string | null>(null)
export const commentSortAtom = atom<'newest' | 'oldest'>('newest')
export const replyingToCommentAtom = atom<{ id: string; path: string } | null>(null)
export const commentPageAtom = atom(1)
export const commentLimitAtom = atom(10)

export const commentsQueryAtom = atomWithQuery((get) => {
  const postId = get(currentPostIdAtom)
  const sort = get(commentSortAtom)
  const page = get(commentPageAtom)
  const limit = get(commentLimitAtom)

  return {
    queryKey: ['comments', postId, sort, page, limit],
    queryFn: async ({ queryKey }) => {
      const { session } = useAuthStore.getState()
      const token = session?.access_token

      if (!session?.access_token) {
        throw new Error('No auth token available')
      }
      if (!postId) return { comments: [], totalCount: 0 }

      const response = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query: `
            query GetComments($postId: ID!, $sort: CommentSortOption, $page: Int, $limit: Int) {
              commentConnection(postId: $postId, sortBy: $sort, page: $page, limit: $limit) {
                comments {
                  id
                  content
                  path
                  depth
                  createdAt
                  user {
                    id
                    username
                    profileImage
                  }
                }
                totalCount
                hasNextPage
              }
            }
          `,
          variables: { postId, sort, page, limit },
        }),
      })

      const data = await response.json()
      return data.data.commentConnection
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
      parentPath = null,
    }: {
      postId: string
      content: string
      parentPath?: string | null
    }) => {
      const { session } = useAuthStore.getState()
      const token = session?.access_token

      if (!session?.access_token) {
        throw new Error('No auth token available')
      }
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
              parentPath,
            },
          },
        }),
      })

      const data = await response.json()
      return data.data.createComment
    },
  }
})

export const deleteCommentMutationAtom = atomWithMutation(() => {
  return {
    mutationKey: ['deleteComment'],
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      const { session } = useAuthStore.getState()
      const token = session?.access_token
      if (!session?.access_token) {
        throw new Error('No auth token available')
      }
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
      return { ...data.data.deleteComment, postId }
    },
  }
})
