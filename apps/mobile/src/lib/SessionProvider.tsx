import React, { useEffect } from 'react'
import { supabase } from './supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../stores/sessionStore'
import { API_URL } from '@env'
import { LoadingSpinner } from 'components/LoadingSpinner'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { setAuthUser, setUserProfile, setIsLoading } = useSessionStore()
  const queryClient = useQueryClient()

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
        const authUser = {
          id: session.user.id,
          email: session.user.email || '',
        }
        setAuthUser(authUser)
        
        try {
          const checkResponse = await fetch(`${API_URL}/api/profile/check/${authUser.id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          
          const checkData = await checkResponse.json()
          
          if (checkData.exists) {
            const profileResponse = await fetch(`${API_URL}/api/profile/${authUser.id}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
            
            if (profileResponse.ok) {
              const profileData = await profileResponse.json()
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
          } else {
            setUserProfile(null)
          }
        } catch (error) {
          console.error('Error fetching profile:', error)
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

  // Subscribe to auth changes
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.invalidateQueries({ queryKey: ['session'] })
    })
    
    return () => {
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading your session..." />;
  }

  return <>{children}</>
}