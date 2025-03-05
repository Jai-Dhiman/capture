import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { API_URL } from '@env'

export type Comment = {
  id: string
  content: string
  createdAt: string
  user?: {
    id: string
    username: string
    image?: string
  }
  parentComment?: {
    id: string
  }
  replies?: Comment[]
}

export type SortOption = 'newest' | 'oldest'

export const usePostComments = (
  postId?: string,
  parentCommentId?: string | null,
  options?: {
    limit?: number
    sortBy?: SortOption
    enabled?: boolean
  }
) => {
  const { limit = 10, sortBy = 'newest', enabled = true } = options || {}

  return useQuery({
    queryKey: ['comments', postId, parentCommentId, sortBy],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

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
            query GetComments($postId: ID!, $parentCommentId: ID, $limit: Int, $sortBy: CommentSortOption) {
            comments(
              postId: $postId, 
              parentCommentId: $parentCommentId, 
              limit: $limit, 
              sortBy: $sortBy
            ) {
              id
              content
              createdAt
              user {
                id
                username
                image
              }
              parentComment {
                id
              }
            }
          }
          `,
          variables: {
            postId,
            parentCommentId: parentCommentId || null,
            limit,
            sortBy,
          },
        }),
      })

      const data = await response.json()

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message)
      }

      return data.data.comments || []
    },
    enabled: enabled && !!postId,
  })
}

export const useCommentReplies = (commentId?: string, enabled = true) => {
  return useQuery({
    queryKey: ['commentReplies', commentId],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

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
            query GetComment($id: ID!) {
              comment(id: $id) {
                id
                replies {
                  id
                  content
                  createdAt
                  userId
                  user {
                    id
                    username
                    profileImage
                  }
                }
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
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message)
      }

      return data.data.comment?.replies || []
    },
    enabled: enabled && !!commentId,
  })
}

export const useCreateComment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      postId,
      content,
      parentCommentId,
    }: {
      postId: string
      content: string
      parentCommentId?: string
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

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
                createdAt
                user {
                  id
                  username
                  image
                }
                parentComment {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              postId,
              content,
              parentCommentId: parentCommentId || null,
            },
          },
        }),
      })

      const data = await response.json()

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message || 'Unknown GraphQL error')
      }

      return data.data.createComment
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['comments', variables.postId, variables.parentCommentId],
      })

      if (variables.parentCommentId) {
        queryClient.invalidateQueries({
          queryKey: ['commentReplies', variables.parentCommentId],
        })
      }

      queryClient.invalidateQueries({
        queryKey: ['post', variables.postId],
      })
    },
  })
}

export const useDeleteComment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      commentId,
      postId,
      parentCommentId,
    }: {
      commentId: string
      postId: string
      parentCommentId?: string | null
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

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

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message || 'Unknown GraphQL error')
      }

      return {
        ...data.data.deleteComment,
        postId,
        parentCommentId,
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['comments', data.postId, data.parentCommentId],
      })

      queryClient.invalidateQueries({
        queryKey: ['commentReplies', data.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['post', data.postId],
      })
    },
  })
}
