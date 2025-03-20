import React, { useEffect, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'
import { useProfileStore } from '../stores/profileStore'
import { useOnboardingStore } from '../stores/onboardingStore'
import { SplashAnimation } from 'components/ui/SplashAnimation'
import { LoadingSpinner } from 'components/ui/LoadingSpinner'
import { authService } from '../services/authService'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true)
  const [isAuthInitialized, setIsAuthInitialized] = useState(false)
  const [splashMinTimeElapsed, setSplashMinTimeElapsed] = useState(false)
  const { setUser, setSession, setAuthStage } = useAuthStore()
  const { setProfile } = useProfileStore()
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashMinTimeElapsed(true)
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    async function initSession() {
      try {
        await authService.restoreSession()
        
        const { stage } = useAuthStore.getState()
        const { goToStep } = useOnboardingStore.getState()
        
        if (stage === 'phone-verification') {
          goToStep('phone-verification')
        } else if (stage === 'profile-creation') {
          goToStep('profile-setup')
        }
      } catch (error) {
        console.error('Failed to initialize session:', error)
      } finally {
        setIsAuthInitialized(true)
      }
    }
    
    initSession()
  }, [])
  
  useEffect(() => {
    if (isAuthInitialized && splashMinTimeElapsed) {
      setIsInitializing(false)
    }
  }, [isAuthInitialized, splashMinTimeElapsed])
  
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      
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
          
          const { stage } = useAuthStore.getState()
          const { goToStep } = useOnboardingStore.getState()
          
          if (stage === 'phone-verification') {
            goToStep('phone-verification')
          } else if (stage === 'profile-creation') {
            goToStep('profile-setup')
          }
        } catch (error) {
          console.error('Error fetching profile after sign in:', error)
        }
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setAuthStage('unauthenticated')
        useOnboardingStore.getState().resetOnboarding()
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