import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { API_URL } from '@env'

export const useFollowUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
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
            mutation FollowUser($userId: ID!) {
              followUser(userId: $userId) {
                success
                relationship {
                  id
                  followerId
                  followedId
                  createdAt
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
        throw new Error(data.errors[0].message || 'Unknown GraphQL error')
      }

      return data.data.followUser
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    },
  })
}

export const useUnfollowUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
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
            mutation UnfollowUser($userId: ID!) {
              unfollowUser(userId: $userId) {
                success
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
        throw new Error(data.errors[0].message || 'Unknown GraphQL error')
      }

      return data.data.unfollowUser
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    },
  })
}
