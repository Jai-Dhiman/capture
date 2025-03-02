import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { API_URL } from '@env'

export const useUserPosts = (userId?: string) => {
  return useQuery({
    queryKey: ['userPosts', userId],
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
            query GetUserPosts($userId: ID!) {
              profile(id: $userId) {
                id
                posts {
                  id
                  content
                  createdAt
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
            mutation CreatePost($input: PostInput!) {
              createPost(input: $input) {
                id
                content
                createdAt
                user {
                  id
                  username
                  image
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
