// src/lib/SessionProvider.tsx
import React, { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'
import { useProfileStore } from '../stores/profileStore'
import { useProfile } from '../hooks/auth/useProfile'
import { SplashAnimation } from 'components/animation/SplashAnimation'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true)
  const { user, setUser, setSession, status } = useAuthStore()
  const { setProfile } = useProfileStore()
  const queryClient = useQueryClient()
  
  // Only fetch profile if we have a user
  const { data: profileData } = useProfile(user?.id, {
    enabled: !!user?.id && status === 'authenticated',
  })
  
  // Set profile when available
  useEffect(() => {
    if (profileData) {
      setProfile(profileData)
    }
  }, [profileData, setProfile])
  
  // Initialize session
  useEffect(() => {
    async function initSession() {
      try {
        // Check for existing session
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          setUser(null)
          return
        }
        
        if (data.session) {
          // Update auth store with session data
          const { user } = data.session
          
          setUser({
            id: user.id,
            email: user.email || '',
            phone: user.phone || '',
            phone_confirmed_at: user.phone_confirmed_at || undefined,
          })
          
          setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: new Date(data.session.expires_at || 0).getTime(),
          })
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('Failed to initialize session:', error)
        setUser(null)
      } finally {
        setIsInitializing(false)
      }
    }
    
    initSession()
  }, [setUser, setSession])
  
  // Listen for auth changes
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
        
        queryClient.invalidateQueries({ queryKey: ['profile'] })
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        queryClient.clear()
      }
    })
    
    return () => {
      data.subscription.unsubscribe()
    }
  }, [setUser, setSession, setProfile, queryClient])
  
  if (isInitializing) {
    return <SplashAnimation fullScreen />
  }
  
  return <>{children}</>
}