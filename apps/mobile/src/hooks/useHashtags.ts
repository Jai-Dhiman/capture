import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from 'stores/authStore'
import { API_URL } from '@env'

export const useSearchHashtags = (query: string, enabled = false) => {
  return useQuery({
    queryKey: ['hashtags', 'search', query],
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
            query SearchHashtags($query: String!, $limit: Int) {
              searchHashtags(query: $query, limit: $limit) {
                id
                name
              }
            }
          `,
          variables: {
            query,
            limit: 10,
          },
        }),
      })

      const data = await response.json()

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message)
      }

      return data.data.searchHashtags || []
    },
    enabled: enabled && query.length > 0,
    staleTime: 1000 * 60 * 5, // Cache results for 5 minutes
  })
}

export const useCreateHashtag = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
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
            mutation CreateHashtag($name: String!) {
              createHashtag(name: $name) {
                id
                name
              }
            }
          `,
          variables: {
            name,
          },
        }),
      })

      const data = await response.json()

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors)
        throw new Error(data.errors[0].message || 'Unknown GraphQL error')
      }

      return data.data.createHashtag
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hashtags'] })
    },
  })
}
