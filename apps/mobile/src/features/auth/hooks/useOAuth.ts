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
  webClientId: GOOGLE_CLIENT_ID_WEB, // Required for backend authentication
  iosClientId: GOOGLE_CLIENT_ID_IOS, // Optional, for iOS-specific configuration
  offlineAccess: false, // We don't need offline access for this flow
  hostedDomain: '', // Optional, specify a domain for G Suite users
  forceCodeForRefreshToken: false, // We're using ID tokens, not refresh tokens
});

// Debug API configuration
const API_URL = Constants.expoConfig?.extra?.API_URL || process.env.API_URL || 'https://capture-api.jai-d.workers.dev';

console.log('🌐 API Configuration:', {
  API_URL,
  expoConfig: Constants.expoConfig?.extra,
  processEnv: process.env.API_URL,
});

export function useOAuth() {
  const { showAlert } = useAlert();
  const setAuthData = useAuthStore((state) => state.setAuthData);

  // Debug function to check current configuration
  const debugOAuthConfig = () => {
    console.log('🔍 Google Sign-In SDK Configuration:', {
      hasGoogleClientIdIOS: Boolean(GOOGLE_CLIENT_ID_IOS),
      hasGoogleClientIdWeb: Boolean(GOOGLE_CLIENT_ID_WEB),
      hasAppleClientId: Boolean(APPLE_CLIENT_ID),
      platform: Platform.OS,
      buildType: Constants.appOwnership === 'expo' ? 'Expo Go' : 'Development Build',
      environment: {
        GOOGLE_CLIENT_ID_IOS: GOOGLE_CLIENT_ID_IOS ? `${GOOGLE_CLIENT_ID_IOS.substring(0, 20)}...` : 'MISSING',
        GOOGLE_CLIENT_ID_WEB: GOOGLE_CLIENT_ID_WEB ? `${GOOGLE_CLIENT_ID_WEB.substring(0, 20)}...` : 'MISSING',
        APPLE_CLIENT_ID: APPLE_CLIENT_ID ? `${APPLE_CLIENT_ID.substring(0, 20)}...` : 'MISSING',
      },
    });
  };

  // Test backend connectivity
  const testBackendConnectivity = async () => {
    try {
      console.log('🔍 Testing backend connectivity...');
      const response = await fetch(`${API_URL}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('🔍 Backend health check response:', {
        status: response.status,
        ok: response.ok,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
      });
      
      if (response.ok) {
        const data = await response.text();
        console.log('✅ Backend is accessible:', data);
        return true;
      }
      
      console.log('❌ Backend health check failed:', response.status);
      return false;
    } catch (error) {
      console.error('❌ Backend connectivity test failed:', error);
      return false;
    }
  };

  // Google OAuth with official SDK
  const googleOAuthMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      // Debug configuration before starting OAuth
      debugOAuthConfig();

      // Test backend connectivity
      await testBackendConnectivity();

      if (!GOOGLE_CLIENT_ID_WEB) {
        throw new Error('Google OAuth not configured - missing web client ID');
      }

      try {
        console.log('🔄 Starting Google Sign-In with official SDK...');

        // Check if Google Play services are available (Android only)
        await GoogleSignin.hasPlayServices();

        // Sign in with Google
        const result = await GoogleSignin.signIn();
        
        console.log('✅ Google Sign-In successful:', {
          hasUser: !!result.data?.user,
          hasIdToken: !!result.data?.idToken,
          userEmail: result.data?.user?.email,
        });

        if (!result.data?.idToken) {
          throw new Error('No ID token received from Google Sign-In SDK');
        }

        // Send ID token to backend for verification
        console.log('🔄 Sending ID token to backend for verification...');
        const authResponse = await workersAuthApi.oauthGoogleToken(result.data.idToken);

        console.log('✅ Backend ID token verification successful:', {
          hasUser: !!authResponse.user,
          hasSession: !!authResponse.session,
        });

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
