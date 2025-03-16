import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from 'stores/authStore'
import { API_URL } from '@env'

export const useFollowUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
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

export const useFollowers = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['followers', userId],
    queryFn: async () => {
      if (!userId) return []

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
            query GetFollowers($userId: ID!) {
              followers(userId: $userId) {
                id
                userId
                username
                profileImage
                isFollowing
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

      return data.data.followers || []
    },
    enabled: !!userId,
  })
}

export const useFollowing = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['following', userId],
    queryFn: async () => {
      if (!userId) return []

      try {
        const { session } = useAuthStore.getState()
        const token = session?.access_token

        if (!session?.access_token) {
          console.warn('No auth token available')
          return []
        }

        const response = await fetch(`${API_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: `
              query GetFollowing($userId: ID!) {
                following(userId: $userId) {
                  id
                  userId
                  username
                  profileImage
                  isFollowing
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
          return []
        }

        return data.data?.following || []
      } catch (error) {
        console.error('Error fetching following:', error)
        return []
      }
    },
    enabled: !!userId,
  })
}
