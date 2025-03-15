import React, { useEffect } from 'react'
import { supabase } from './supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../stores/sessionStore'
import { API_URL } from '@env'
import { LoadingSpinner } from 'components/LoadingSpinner' 

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { setAuthUser, setUserProfile, setIsLoading } = useSessionStore()
  const queryClient = useQueryClient()

  const fetchUserProfile = async (userId: string, token: string) => {
    try {
      const checkResponse = await fetch(`${API_URL}/api/profile/check/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!checkResponse.ok) throw new Error('Profile check failed')

      const checkData = await checkResponse.json()

      if (checkData.exists) {
        const profileResponse = await fetch(`${API_URL}/api/profile/${userId}`, {
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

  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    const handleSessionChange = async () => {
      setIsLoading(true)
      
      if (session) {
        // Set basic auth user info
        const authUser = {
          id: session.user.id,
          email: session.user.email || '',
          phone: session.user.phone || '',
          phone_confirmed_at: session.user.phone_confirmed_at || undefined,
        }
        
        setAuthUser(authUser)
        
        // Only fetch profile if phone is verified
        if (authUser.phone && authUser.phone_confirmed_at) {
          try {
            const profileData = await fetchUserProfile(authUser.id, session.access_token)
            if (profileData) {
              setUserProfile({
                id: profileData.id,
                supabase_id: authUser.id,
                username: profileData.username,
                bio: profileData.bio || undefined,
                profileImage: profileData.profileImage || undefined,
              })
            } else {
              setUserProfile(null)
            }
          } catch (error) {
            console.error('Error fetching profile:', error)
            setUserProfile(null)
          }
        } else {
          // Don't attempt profile fetch if phone not verified
          setUserProfile(null)
        }
      } else {
        setAuthUser(null)
        setUserProfile(null)
      }
      
      setIsLoading(false)
    }
    
    handleSessionChange()
  }, [session, setAuthUser, setUserProfile, setIsLoading])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.invalidateQueries({ queryKey: ['session'] })
    })
    
    return () => {
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading your session..." />
  }

  return <>{children}</>
}