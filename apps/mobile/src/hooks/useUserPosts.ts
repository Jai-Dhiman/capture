import { useQuery } from '@tanstack/react-query'
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
