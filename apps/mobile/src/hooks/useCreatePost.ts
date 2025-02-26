import { useMutation } from '@tanstack/react-query'
import { API_URL } from '@env'
import { supabase } from 'lib/supabase'

export const useCreatePost = () => {
  return useMutation({
    mutationFn: async ({ content, mediaIds }: { content: string; mediaIds: string[] }) => {
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
                captags {
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
