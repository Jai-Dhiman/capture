import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from 'stores/authStore'
import { API_URL } from '@env'

export const useUserPosts = (userId?: string) => {
  return useQuery({
    queryKey: ['userPosts', userId],
    queryFn: async () => {
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
            query GetUserPosts($userId: ID!) {
              profile(id: $userId) {
                id
                posts {
                  id
                  content
                  createdAt
                  isSaved
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
          variables: {
            userId,
          },
        }),
      })

      const data = await response.json()

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message)
      }

      return data.data.profile?.posts || []
    },
    enabled: !!userId,
  })
}

export const useSinglePost = (postId?: string) => {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
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
            query GetPost($postId: ID!) {
              post(id: $postId) {
                id
                content
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
        }),
      })

      const data = await response.json()

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message)
      }

      return data.data.post
    },
    enabled: !!postId,
  })
}

export const useCreatePost = () => {
  return useMutation({
    mutationFn: async ({
      content,
      mediaIds,
      hashtagIds,
    }: {
      content: string
      mediaIds: string[]
      hashtagIds?: string[]
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
            mutation CreatePost($input: PostInput!) {
              createPost(input: $input) {
                id
                content
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
              mediaIds,
              hashtagIds,
            },
          },
        }),
      })

      const data = await response.json()

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message || 'Unknown GraphQL error')
      }

      return data.data.createPost
    },
  })
}

export const useDeletePost = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
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
        }),
      })

      const data = await response.json()

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message || 'Unknown GraphQL error')
      }

      return data.data.deletePost
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['userPosts'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
