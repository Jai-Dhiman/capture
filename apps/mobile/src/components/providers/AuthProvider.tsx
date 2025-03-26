import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { useProfileStore } from '../../stores/profileStore';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { SplashAnimation } from '../ui/SplashAnimation';
import { authService } from '../../services/authService';
import { errorService } from '../../services/errorService';
import { useAlert } from '../../lib/AlertContext';
import NetInfo from '@react-native-community/netinfo';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const [splashMinTimeElapsed, setSplashMinTimeElapsed] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { 
    session, 
    setUser, 
    setSession, 
    refreshSession, 
    clearAuth, 
    setAuthStage,
    setIsRefreshing,
    isRefreshing,
    processOfflineQueue
  } = useAuthStore();
  const { setProfile } = useProfileStore();
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const refreshRetryCount = useRef(0);
  const MAX_REFRESH_RETRIES = 3;
  
  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = isOffline;
      setIsOffline(!state.isConnected);
      
      // If we're going from offline to online, process the queued requests
      if (wasOffline && state.isConnected) {
        processOfflineQueue();
      }
    });
    
    return () => unsubscribe();
  }, [isOffline, processOfflineQueue]);
  
  // Minimum splash screen time
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashMinTimeElapsed(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Initialize session on app start
  useEffect(() => {
    async function initSession() {
      try {
        await authService.restoreSession();
        
        const { stage } = useAuthStore.getState();
        const { goToStep } = useOnboardingStore.getState();
        
        if (stage === 'phone-verification') {
          goToStep('phone-verification');
        } else if (stage === 'profile-creation') {
          goToStep('profile-setup');
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
      } finally {
        setIsAuthInitialized(true);
      }
    }
    
    initSession();
  }, []);
  
  // Transition from splash screen when ready
  useEffect(() => {
    if (isAuthInitialized && splashMinTimeElapsed) {
      setIsInitializing(false);
    }
  }, [isAuthInitialized, splashMinTimeElapsed]);
  
  // Handle app state changes for token refresh
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        if (session?.access_token && !isRefreshing && !isOffline) {
          handleTokenRefresh();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [session?.access_token, isRefreshing, isOffline]);
  
  // Set up token refresh timer based on expiration
  useEffect(() => {
    if (!session?.access_token || isOffline) return;

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const timeUntilExpiry = Math.max(0, session.expires_at - Date.now() - 5 * 60 * 1000);

    refreshTimerRef.current = setTimeout(() => {
      handleTokenRefresh();
    }, timeUntilExpiry);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [session?.access_token, session?.expires_at, isOffline]);
  
  // Setup event listener for deep links (to replace Supabase's onAuthStateChange)
  useEffect(() => {
    // Here you would set up your custom deep link handler
    // Add logic to handle authentication-related deep links
    // This would replace the Supabase onAuthStateChange
    
    const setupDeepLinkHandlers = async () => {
      // Implementation would be specific to your deep link handling approach
      // For example, using Expo's Linking API
    };
    
    setupDeepLinkHandlers();
    
    return () => {
      // Clean up any listeners
    };
  }, []);
  
  // Token refresh handler with retries and offline handling
  const handleTokenRefresh = async () => {
    if (isRefreshing || isOffline) return;
    
    setIsRefreshing(true);
    try {
      const refreshedSession = await refreshSession();
      if (refreshedSession) {
        // Success - reset retry counter
        refreshRetryCount.current = 0;
      } else {
        throw new Error("Failed to refresh session");
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      
      if (isOffline) {
        // We're offline, so we'll try again when we're back online
        console.log("Device is offline, will retry token refresh when online");
        return;
      }
      
      // Implement exponential backoff for retries
      if (refreshRetryCount.current < MAX_REFRESH_RETRIES) {
        refreshRetryCount.current += 1;
        const backoffTime = Math.pow(2, refreshRetryCount.current) * 1000; // Exponential backoff
        console.log(`Retrying token refresh in ${backoffTime}ms (attempt ${refreshRetryCount.current}/${MAX_REFRESH_RETRIES})`);
        
        setTimeout(() => {
          handleTokenRefresh();
        }, backoffTime);
      } else {
        // We've exhausted retries, but don't automatically log the user out
        // Give them a chance to manually retry
        const appError = errorService.createError(
          "Your session has expired. Please log in again.",
          "auth/session-expired",
          error instanceof Error ? error : undefined
        );
        
        showAlert(appError.message, {
          type: errorService.getAlertType(appError.category),
          buttons: [
            {
              text: "Try Again",
              onPress: () => {
                refreshRetryCount.current = 0;
                handleTokenRefresh();
              }
            },
            {
              text: "Log Out",
              onPress: () => clearAuth()
            }
          ]
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };
  
  if (isInitializing) {
    return <SplashAnimation fullScreen />;
  }
  
  return <>{children}</>;
}