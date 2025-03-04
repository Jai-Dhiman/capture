import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { API_URL } from '@env'

export const useImageUrl = (mediaId?: string, expirySeconds = 1800) => {
  const staleTime = Math.min(expirySeconds * 1000 * 0.8, 20 * 60 * 1000)
  const isCloudflareId = mediaId && mediaId.includes('-')

  return useQuery({
    queryKey: ['imageUrl', mediaId, expirySeconds],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('No auth token available')
      }

      const endpoint = isCloudflareId
        ? `${API_URL}/api/media/cloudflare/${mediaId}/url?expiry=${expirySeconds}`
        : `${API_URL}/api/media/${mediaId}/url?expiry=${expirySeconds}`

      const response = await fetch(endpoint, {
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

export const useCloudflareImageUrl = (cloudflareId?: string, expirySeconds = 1800) => {
  const staleTime = Math.min(expirySeconds * 1000 * 0.8, 20 * 60 * 1000)

  return useQuery({
    queryKey: ['cloudflareImageUrl', cloudflareId, expirySeconds],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('No auth token available')
      }

      const response = await fetch(
        `${API_URL}/api/media/cloudflare-url/${cloudflareId}?expiry=${expirySeconds}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch image URL')
      }

      const data = await response.json()
      return data.url
    },
    enabled: !!cloudflareId,
    staleTime: staleTime,
    gcTime: staleTime + 5 * 60 * 1000,
  })
}

export const useMediaSource = (mediaItem: any, expirySeconds = 1800) => {
  // Case 1: Direct Cloudflare ID (string)
  if (typeof mediaItem === 'string') {
    return useCloudflareImageUrl(mediaItem, expirySeconds)
  }

  // Case 2: Media object with storageKey (from database)
  if (mediaItem?.storageKey) {
    return useCloudflareImageUrl(mediaItem.storageKey, expirySeconds)
  }

  // Case 3: Media object with internal ID (needs API lookup)
  if (mediaItem?.id) {
    return useImageUrl(mediaItem.id, expirySeconds)
  }

  // Default case: No valid media source
  return {
    data: null,
    isLoading: false,
    error: new Error('Invalid media source'),
    isStale: false,
  }
}
