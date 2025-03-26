import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { useProfileStore } from '../../stores/profileStore';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { SplashAnimation } from '../ui/SplashAnimation';
import { authService } from '../../services/authService';
import { errorService } from '../../services/errorService';
import { useAlert } from '../../lib/AlertContext';
import NetInfo from '@react-native-community/netinfo';
import * as Linking from 'expo-linking';

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
    processOfflineQueue,
    user
  } = useAuthStore();
  const { setProfile, profile, clearProfile } = useProfileStore();
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const refreshRetryCount = useRef(0);
  const MAX_REFRESH_RETRIES = 3;
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = isOffline;
      setIsOffline(!state.isConnected);
      
      if (wasOffline && state.isConnected) {
        processOfflineQueue();
      }
    });
    
    return () => unsubscribe();
  }, [isOffline, processOfflineQueue]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashMinTimeElapsed(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    async function initSession() {
      try {
        const sessionRestored = await authService.restoreSession();
        
        if (sessionRestored) {
          const { stage, user, session } = useAuthStore.getState();
          
          if (user && session) {
            const profileData = await authService.fetchUserProfile(user.id, session.access_token);
            
            if (profileData) {
              setProfile({
                id: profileData.id,
                userId: profileData.userId,
                username: profileData.username,
                bio: profileData.bio || undefined,
                profileImage: profileData.profileImage || undefined,
              });
              
              setAuthStage('complete');
            } else if (stage === 'unauthenticated') {
              setAuthStage('profile-creation');
            }
          }
          
          const { goToStep } = useOnboardingStore.getState();
          
          if (stage === 'phone-verification') {
            goToStep('phone-verification');
          } else if (stage === 'profile-creation') {
            goToStep('profile-setup');
          }
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
        clearAuth();
      } finally {
        setIsAuthInitialized(true);
      }
    }
    
    initSession();
  }, []);
  
  useEffect(() => {
    if (isAuthInitialized && splashMinTimeElapsed) {
      setIsInitializing(false);
    }
  }, [isAuthInitialized, splashMinTimeElapsed]);
  
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
  
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      try {
        const redirectPath = await authService.handleAuthCallback(event.url);
        if (redirectPath) {
          const { user, session } = useAuthStore.getState();
          
          if (user && session) {
            const profileData = await authService.fetchUserProfile(user.id, session.access_token);
            
            if (profileData) {
              setProfile({
                id: profileData.id,
                userId: user.id,
                username: profileData.username,
                bio: profileData.bio || undefined,
                profileImage: profileData.profileImage || undefined,
              });
              setAuthStage('complete');
            } else {
              setAuthStage('profile-creation');
              useOnboardingStore.getState().goToStep('profile-setup');
            }
          }
        }
      } catch (error) {
        console.error('Deep link handling error:', error);
        const appError = errorService.handleAuthError(error);
        showAlert(appError.message, {
          type: errorService.getAlertType(appError.category)
        });
      }
    };
    
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });
    
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  useEffect(() => {
    if (!user) {
      setAuthStage('unauthenticated');
      return;
    }
    
    if (user && !profile) {
      setAuthStage('profile-creation');
      return;
    }
    
    if (user && !user.phone_confirmed_at && user.phone) {
      setAuthStage('phone-verification');
      return;
    }
    
    if (user && profile) {
      setAuthStage('complete');
      return;
    }
  }, [user, profile]);
  
  const handleTokenRefresh = async () => {
    if (isRefreshing || isOffline) return;
    
    setIsRefreshing(true);
    try {
      const refreshedSession = await refreshSession();
      if (refreshedSession) {
        refreshRetryCount.current = 0;
      } else {
        throw new Error("Failed to refresh session");
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      
      if (isOffline) {
        console.log("Device is offline, will retry token refresh when online");
        return;
      }
      
      if (refreshRetryCount.current < MAX_REFRESH_RETRIES) {
        refreshRetryCount.current += 1;
        const backoffTime = Math.pow(2, refreshRetryCount.current) * 1000;
        console.log(`Retrying token refresh in ${backoffTime}ms (attempt ${refreshRetryCount.current}/${MAX_REFRESH_RETRIES})`);
        
        setTimeout(() => {
          handleTokenRefresh();
        }, backoffTime);
      } else {
        const appError = errorService.createError(
          "Your session has expired. Please log in again.",
          "auth/session-expired",
          error instanceof Error ? error : undefined
        ); 
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again.",
          [
            {
              text: "Try Again",
              onPress: () => {
                refreshRetryCount.current = 0;
                handleTokenRefresh();
              }
            },
            {
              text: "Log Out",
              onPress: () => {
                clearAuth();
                clearProfile();
                queryClient.clear();
              },
              style: 'destructive'
            }
          ],
          { cancelable: false }
        );
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