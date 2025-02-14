import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from 'lib/supabase'
import { API_URL } from '@env'

export const useUploadMedia = () => {
  return useMutation({
    mutationFn: async (files: Array<any>) => {
      const session = await supabase.auth.getSession()
      if (!session.data.session?.access_token) {
        throw new Error('No auth token available')
      }

      const uploads = files.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file as any)

        const response = await fetch(`${API_URL}/api/media`, {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Upload failed')
        return data.media
      })

      return Promise.all(uploads)
    },
  })
}

export const useUserMedia = () => {
  return useQuery({
    queryKey: ['userMedia'],
    queryFn: async () => {
      const session = await supabase.auth.getSession()
      if (!session.data.session?.access_token) {
        throw new Error('No auth token available')
      }

      const response = await fetch(`${API_URL}/api/media/user`, {
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
        },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch media')
      return data.media || []
    },
  })
}
