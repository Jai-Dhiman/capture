import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { API_URL } from '@env'

export const useSignedUrl = (mediaId?: string) => {
  return useQuery({
    queryKey: ['signedUrl', mediaId],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('No auth token available')
      }

      const response = await fetch(`${API_URL}/api/media/${mediaId}/url`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch signed URL')
      }

      const data = await response.json()
      return data.url
    },
    enabled: !!mediaId,
  })
}
