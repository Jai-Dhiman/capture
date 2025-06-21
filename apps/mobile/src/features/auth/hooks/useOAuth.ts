import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { useMutation } from '@tanstack/react-query';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { workersAuthApi } from '../lib/workersAuthApi';
import { useAuthStore } from '../stores/authStore';
import type { AuthResponse } from '../types';

const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const APPLE_CLIENT_ID = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || '';

// Configure Google Sign-In SDK
GoogleSignin.configure({
  webClientId: GOOGLE_CLIENT_ID_WEB,
  iosClientId: GOOGLE_CLIENT_ID_IOS, 
  offlineAccess: false, 
  hostedDomain: '', 
  forceCodeForRefreshToken: false,
});

export function useOAuth() {
  const { showAlert } = useAlert();
  const setAuthData = useAuthStore((state) => state.setAuthData);


  // Google OAuth with official SDK
  const googleOAuthMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      if (!GOOGLE_CLIENT_ID_WEB || !GOOGLE_CLIENT_ID_IOS) {
        throw new Error(`Google OAuth not configured - missing client IDs. Web: ${!!GOOGLE_CLIENT_ID_WEB}, iOS: ${!!GOOGLE_CLIENT_ID_IOS}`);
      }

      try {
        await GoogleSignin.hasPlayServices();

        const result = await GoogleSignin.signIn();
        
        if (!result.data?.idToken) {
          throw new Error('No ID token received from Google Sign-In SDK');
        }

        // Send ID token to backend for verification
        const authResponse = await workersAuthApi.oauthGoogleToken(result.data.idToken);
        
        return authResponse;

      } catch (error: any) {
        console.error('❌ Google Sign-In failed:', error);

        // Handle specific Google Sign-In errors
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          throw new Error('Google Sign-In was cancelled');
        }
        if (error.code === statusCodes.IN_PROGRESS) {
          throw new Error('Google Sign-In is already in progress');
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          throw new Error('Google Play Services not available');
        }
        throw new Error(`Google Sign-In failed: ${error.message || 'Unknown error'}`);
      }
    },
    onSuccess: (data) => {
      setAuthData(data);
      showAlert('Successfully signed in with Google!', { type: 'success' });
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Apple OAuth (keeping the existing implementation for now)
  const appleOAuthMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      throw new Error('Apple OAuth implementation needs to be updated - not implemented yet');
    },
    onSuccess: (data) => {
      setAuthData(data);
      showAlert('Successfully signed in with Apple!', { type: 'success' });
    },
    onError: (error) => {
      console.error('Apple OAuth error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Check if OAuth providers are configured
  const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID_WEB);
  const isAppleConfigured = Boolean(APPLE_CLIENT_ID);

  return {
    loginWithGoogle: googleOAuthMutation,
    loginWithApple: appleOAuthMutation,
    isGoogleConfigured,
    isAppleConfigured,
  };
}
