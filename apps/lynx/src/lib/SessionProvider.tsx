import { useState, useEffect } from '@lynx-js/react'
import { supabase } from './supabase.ts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../stores/sessionStore.ts'

const api_url = process.env.API_URL || 'localhost:8787'

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
          const checkResponse = await fetch(`${api_url}/api/profile/check/${authUser.id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          
          const checkData = await checkResponse.json()
          
          if (checkData.exists) {
            const profileResponse = await fetch(`${api_url}/api/profile/${authUser.id}`, {
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
    return <view style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      zIndex: 999,
    }}>
      <text>Loading your session...</text>
    </view>
  }

  return <>{children}</>
}