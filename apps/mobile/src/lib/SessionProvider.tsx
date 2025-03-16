import React, { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'
import { useProfileStore } from '../stores/profileStore'
import { SplashAnimation } from 'components/animation/SplashAnimation'
import { authService } from '../services/authService'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true)
  const { setUser, setSession, setAuthStage } = useAuthStore()
  const { setProfile } = useProfileStore()
  const queryClient = useQueryClient()
  
  useEffect(() => {
    async function initSession() {
      try {
        await authService.restoreSession()
      } catch (error) {
        console.error('Failed to initialize session:', error)
      } finally {
        setIsInitializing(false)
      }
    }
    
    initSession()
  }, [])
  
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event)
      
      if (event === 'SIGNED_IN' && session) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          phone: session.user.phone || '',
          phone_confirmed_at: session.user.phone_confirmed_at || undefined,
        })
        
        setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: new Date(session.expires_at || 0).getTime(),
        })
        
        try {
          const profileData = await authService.fetchUserProfile(
            session.user.id,
            session.access_token
          )
          
          if (profileData) {
            setProfile(profileData)
          }
          
          authService.updateAuthStage()
          queryClient.invalidateQueries({ queryKey: ['profile'] })
        } catch (error) {
          console.error('Error fetching profile after sign in:', error)
        }
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setAuthStage('unauthenticated')
        queryClient.clear()
      }
    })
    
    return () => {
      data.subscription.unsubscribe()
    }
  }, [setUser, setSession, setProfile, setAuthStage, queryClient])
  
  if (isInitializing) {
    return <SplashAnimation fullScreen />
  }
  
  return <>{children}</>
}