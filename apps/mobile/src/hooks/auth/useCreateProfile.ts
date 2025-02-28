// src/hooks/useCreateProfile.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSessionStore } from '../../stores/sessionStore'
import { API_URL } from '@env'

export function useCreateProfile() {
  const queryClient = useQueryClient()
  const { authUser, setUserProfile } = useSessionStore()

  // Upload image hook (reusing from your existing code)
  const uploadImage = async (token: string, imageUri: string) => {
    try {
      const uploadUrlResponse = await fetch(`${API_URL}/api/media/image-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { uploadURL, id: imageId } = await uploadUrlResponse.json()

      const formData = new FormData()
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile-image.jpg',
      } as any)

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
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageId: cloudflareImageId,
          order: 0,
        }),
      })

      if (!createRecordResponse.ok) {
        throw new Error('Failed to create media record')
      }

      const { media } = await createRecordResponse.json()
      return media.storageKey
    } catch (error) {
      console.error('Image upload error:', error)
      throw error
    }
  }

  // Username availability check
  const checkUsernameAvailability = async (username: string, token: string) => {
    const response = await fetch(`${API_URL}/api/profile/check-username?username=${username}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await response.json()
    return data.available
  }

  // Create profile mutation
  return useMutation({
    mutationFn: async ({
      username,
      bio,
      profileImage,
    }: {
      username: string
      bio?: string
      profileImage?: string | null
    }) => {
      if (!authUser) throw new Error('Not authenticated')

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('No auth token available')
      }

      // Check username availability
      const isAvailable = await checkUsernameAvailability(username, token)
      if (!isAvailable) {
        throw new Error('Username already taken')
      }

      // Upload image if provided
      let storageKey = null
      if (profileImage) {
        storageKey = await uploadImage(token, profileImage)
      }

      // Create profile
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: authUser.id,
          username,
          bio: bio?.trim() || null,
          profileImage: storageKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create profile')
      }

      return await response.json()
    },
    onSuccess: (profileData) => {
      if (authUser) {
        setUserProfile({
          id: profileData.id,
          supabase_id: authUser.id,
          username: profileData.username,
          bio: profileData.bio || undefined,
          image: profileData.profileImage || undefined,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['session'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
