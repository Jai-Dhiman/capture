import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { API_URL } from '@env'

export const useImageUrl = (mediaId?: string, expirySeconds = 1800) => {
  const staleTime = Math.min(expirySeconds * 1000 * 0.8, 20 * 60 * 1000)

  return useQuery({
    queryKey: ['imageUrl', mediaId, expirySeconds],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('No auth token available')
      }

      const response = await fetch(`${API_URL}/api/media/${mediaId}/url?expiry=${expirySeconds}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch image URL')
      }

      const data = await response.json()
      return data.url
    },
    enabled: !!mediaId,
    staleTime: staleTime,
    gcTime: staleTime + 5 * 60 * 1000,
  })
}
