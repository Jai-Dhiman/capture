// src/hooks/useProfile.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { API_URL } from '@env'

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('No auth token available')
      }

      const response = await fetch(`${API_URL}/api/profile/${userId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error('Failed to fetch profile')
      }

      return await response.json()
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCheckProfileExists(userId?: string) {
  return useQuery({
    queryKey: ['profileExists', userId],
    queryFn: async () => {
      if (!userId) return false

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) return false

      try {
        const response = await fetch(`${API_URL}/api/profile/check/${userId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) return false

        const data = await response.json()
        return data.exists
      } catch (error) {
        console.error('Error checking profile:', error)
        return false
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
