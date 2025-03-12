import { useState } from '@lynx-js/react'
import { supabase } from '../../lib/supabase.ts'
import { useSessionStore } from '../../stores/sessionStore.ts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

const api_url = process.env.API_URL || ''

const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const profileResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  bio: z.string().nullable().optional(),
  profileImage: z.string().nullable().optional(),
})

export function useAuth() {
  const [loading, setLoading] = useState(false)
  const { setAuthUser, setUserProfile, clearSession } = useSessionStore()
  const queryClient = useQueryClient()

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

        const profileData = await profileResponse.json()
        return profileResponseSchema.parse(profileData)
      }

      return null
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  }

  const login = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const validatedInput = loginInputSchema.parse(credentials)
      const { email, password } = validatedInput

      setLoading(true)

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      if (!authData.user?.email_confirmed_at) {
        throw new Error('Please verify your email before logging in')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) throw new Error('No auth token available')

      const profileData = await fetchUserProfile(authData.user.id, token)

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
      setLoading(false)
    },
  })

  const signup = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const validatedInput = loginInputSchema.parse(credentials)
      const { email, password } = validatedInput

      setLoading(true)

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      return data
    },
    onSettled: () => {
      setLoading(false)
    },
  })

  const logout = useMutation({
    mutationFn: async () => {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      clearSession()
      queryClient.clear()
    },
    onSettled: () => {
      setLoading(false)
    },
  })

  return {
    login,
    signup,
    logout,
    loading,
  }
}
