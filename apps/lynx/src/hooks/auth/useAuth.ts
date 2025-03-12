import { useState } from '@lynx-js/react'
import { supabase } from '../../lib/supabase.ts'
import { useSessionStore } from '../../stores/sessionStore.ts'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const api_url = process.env.API_URL || 'localhost:8787'

export function useAuth() {
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { setAuthUser, setUserProfile, clearSession } = useSessionStore()
  const queryClient = useQueryClient()

  const clearMessages = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }

  const fetchUserProfile = async (userId: string, token: string) => {
    try {
      const checkResponse = await fetch(`${api_url}/api/profile/check/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!checkResponse.ok) throw new Error('Profile check failed')

      const checkData = await checkResponse.json()

      if (checkData.exists) {
        const profileResponse = await fetch(`${api_url}/api/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!profileResponse.ok) throw new Error('Failed to fetch profile')

        return await profileResponse.json()
      }

      return null
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  }

  const login = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      setIsLoading(true)
      clearMessages()

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setErrorMessage(authError.message)
        throw authError
      }

      if (!authData.user?.email_confirmed_at) {
        const error = new Error('Please verify your email before logging in')
        setErrorMessage(error.message)
        throw error
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        const error = new Error('No auth token available')
        setErrorMessage(error.message)
        throw error
      }

      const profileData = await fetchUserProfile(authData.user.id, token)

      setSuccessMessage('Login successful!')

      return {
        user: authData.user,
        profile: profileData,
      }
    },
    onSuccess: (data) => {
      setAuthUser({
        id: data.user.id,
        email: data.user.email || '',
      })

      if (data.profile) {
        setUserProfile({
          id: data.profile.id,
          supabase_id: data.user.id,
          username: data.profile.username,
          bio: data.profile.bio || undefined,
          profileImage: data.profile.profileImage || undefined,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['session'] })
    },
    onError: (error) => {
      console.error('Login error:', error)
    },
    onSettled: () => {
      setIsLoading(false)
    },
  })

  const logout = useMutation({
    mutationFn: async () => {
      setIsLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      clearSession()
      queryClient.clear()
      setSuccessMessage('Logged out successfully')
    },
    onSettled: () => {
      setIsLoading(false)
    },
  })

  return {
    login,
    logout,
    isLoading,
    errorMessage,
    successMessage,
    clearMessages,
  }
}
