import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import * as Linking from 'expo-linking';
import { authService } from '../../services/authService';
import { authState } from '../../stores/authState';
import { useAuthStore } from '../../stores/authStore';
import { SplashAnimation } from '../ui/SplashAnimation';
import { errorService } from '../../services/errorService';
import { useAlert } from '../../lib/AlertContext';

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
    refreshSession, 
    isRefreshing,
    processOfflineQueue
  } = useAuthStore();
  
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
          const stage = await authService.determineAuthStage();
          authState.setAuthStage(stage);
          
          if (stage === 'phone-verification') {
            authState.updateOnboardingStep('phone-verification');
          } else if (stage === 'profile-creation') {
            authState.updateOnboardingStep('profile-setup');
          }
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
        authState.clearAuth();
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
          const stage = await authService.determineAuthStage();
          authState.setAuthStage(stage);
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
  
  const handleTokenRefresh = async () => {
    if (isRefreshing || isOffline) return;
    
    authState.beginRefreshingSession();
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
        return;
      }
      
      if (refreshRetryCount.current < MAX_REFRESH_RETRIES) {
        refreshRetryCount.current += 1;
        const backoffTime = Math.pow(2, refreshRetryCount.current) * 1000;
        
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
                authState.clearAuth();
                queryClient.clear();
              },
              style: 'destructive'
            }
          ],
          { cancelable: false }
        );
      }
    } finally {
      authState.endRefreshingSession();
    }
  };
  
  if (isInitializing) {
    return <SplashAnimation fullScreen />;
  }
  
  return <>{children}</>;
}