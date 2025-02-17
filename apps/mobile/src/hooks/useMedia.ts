import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from 'lib/supabase'
import { API_URL } from '@env'

export const useUploadMedia = () => {
  return useMutation({
    mutationFn: async (files: Array<any>) => {
      console.log('Starting file upload, files:', files)
      const session = await supabase.auth.getSession()
      if (!session.data.session?.access_token) {
        throw new Error('No auth token available')
      }

      const uploads = files.map(async (file) => {
        const formData = new FormData()
        console.log('Processing file:', file)

        if (file.uri.startsWith('data:')) {
          const response = await fetch(file.uri)
          const blob = await response.blob()
          formData.append('file', blob, file.name)
        } else {
          formData.append('file', {
            uri: file.uri,
            type: file.type || 'image/jpeg',
            name: file.name || 'upload.jpg',
          } as any)
        }

        console.log('FormData created:', formData)

        try {
          const response = await fetch(`${API_URL}/api/media`, {
            method: 'POST',
            body: formData,
            headers: {
              Authorization: `Bearer ${session?.data?.session?.access_token}`,
              // Remove Content-Type header to let the browser set it automatically
              // with the correct boundary
            },
          })

          console.log('Upload response status:', response.status)
          const data = await response.json()
          console.log('Upload response data:', data)

          if (!response.ok) throw new Error(data.error || 'Upload failed')
          return data.media
        } catch (error) {
          console.error('Upload error:', error)
          throw error
        }
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
