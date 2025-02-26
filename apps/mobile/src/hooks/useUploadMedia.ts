import { useMutation } from '@tanstack/react-query'
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
        try {
          const uploadUrlResponse = await fetch(`${API_URL}/api/media/image-upload`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.data.session?.access_token}`,
              'Content-Type': 'application/json',
            },
          })

          if (!uploadUrlResponse.ok) {
            throw new Error('Failed to get upload URL')
          }

          const { uploadURL, id: imageId } = await uploadUrlResponse.json()

          const formData = new FormData()

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

          const uploadResponse = await fetch(uploadURL, {
            method: 'POST',
            body: formData,
          })

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image to Cloudflare')
          }

          const uploadResponseData = await uploadResponse.json()
          const cloudflareImageId = uploadResponseData.result.id

          const createRecordResponse = await fetch(`${API_URL}/api/media/image-record`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.data.session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageId: cloudflareImageId,
              order: file.order,
            }),
          })

          if (!createRecordResponse.ok) {
            throw new Error('Failed to create media record')
          }

          const { media } = await createRecordResponse.json()
          return media
        } catch (error) {
          console.error('Upload error:', error)
          throw error
        }
      })

      return Promise.all(uploads)
    },
  })
}
