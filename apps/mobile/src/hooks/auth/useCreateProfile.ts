import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSessionStore } from '../../stores/sessionStore'
import { API_URL } from '@env'

export function useCreateProfile() {
  const queryClient = useQueryClient()
  const { authUser, setUserProfile } = useSessionStore()

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

      if (imageUri.startsWith('data:')) {
        console.log('Detected base64 image, converting to blob')
        try {
          const response = await fetch(imageUri)
          const blob = await response.blob()
          formData.append('file', blob, 'profile.jpg')
        } catch (error) {
          console.error('Error converting base64 to blob:', error)
          throw new Error('Failed to process base64 image')
        }
      } else {
        formData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any)
      }

      const uploadResponse = await fetch(uploadURL, {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('Upload error response:', errorText)
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`)
      }

      const uploadResponseData = await uploadResponse.json()

      return uploadResponseData.result.id
    } catch (error) {
      console.error('Image upload error:', error)
      throw error
    }
  }

  const checkUsernameAvailability = async (username: string, token: string) => {
    const response = await fetch(`${API_URL}/api/profile/check-username?username=${username}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await response.json()
    return data.available
  }

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

      const isAvailable = await checkUsernameAvailability(username, token)
      if (!isAvailable) {
        throw new Error('Username already taken')
      }

      let cloudflareImageId = null
      if (profileImage) {
        try {
          cloudflareImageId = await uploadImage(token, profileImage)
        } catch (error) {
          console.error('Image upload failed but continuing:', error)
        }
      }

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
          profileImage: cloudflareImageId,
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
          profileImage: profileData.profileImage || undefined,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['session'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
