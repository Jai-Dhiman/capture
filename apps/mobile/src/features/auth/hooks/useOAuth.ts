import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useMutation } from '@tanstack/react-query';
import * as AppleAuthentication from 'expo-apple-authentication';
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
        throw new Error(
          `Google OAuth not configured - missing client IDs. Web: ${!!GOOGLE_CLIENT_ID_WEB}, iOS: ${!!GOOGLE_CLIENT_ID_IOS}`,
        );
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

  // Apple OAuth with expo-apple-authentication
  const appleOAuthMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      if (!APPLE_CLIENT_ID) {
        throw new Error('Apple OAuth not configured - missing EXPO_PUBLIC_APPLE_CLIENT_ID');
      }

      console.log('🍎 Starting Apple Sign-In process...');
      console.log('🍎 Apple Client ID:', APPLE_CLIENT_ID);

      // Check if Apple Authentication is available on this device
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      console.log('🍎 Apple Sign-In availability:', isAvailable);

      if (!isAvailable) {
        throw new Error('Apple Sign-In is not available on this device');
      }

      try {
        console.log('🍎 Requesting Apple Sign-In with scopes...');
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        console.log('✅ Apple Sign-In successful:', {
          hasIdentityToken: !!credential.identityToken,
          hasAuthorizationCode: !!credential.authorizationCode,
          email: credential.email,
          state: credential.state,
          user: credential.user ? 'PRESENT' : 'MISSING',
          fullName: credential.fullName ? 'PRESENT' : 'MISSING',
          credentialState: credential.state,
        });

        if (!credential.identityToken) {
          throw new Error('No identity token received from Apple Sign-In');
        }

        console.log('🔐 Sending identity token to backend...');
        // Send identity token to backend for verification
        const authResponse = await workersAuthApi.oauthApple({
          code: credential.authorizationCode || '',
          identityToken: credential.identityToken,
        });

        console.log('✅ Backend authentication successful');
        return authResponse;
      } catch (error: any) {
        console.error('❌ Apple Sign-In failed:', error);
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          domain: error.domain,
          userInfo: error.userInfo,
        });

        // Handle specific Apple Sign-In errors
        if (error.code === 'ERR_REQUEST_CANCELED') {
          throw new Error('Apple Sign-In was cancelled');
        }
        if (error.code === 'ERR_INVALID_RESPONSE') {
          throw new Error('Invalid response from Apple Sign-In');
        }
        if (error.code === 'ERR_REQUEST_FAILED') {
          throw new Error('Apple Sign-In request failed');
        }
        if (error.code === 'ERR_REQUEST_NOT_HANDLED') {
          throw new Error('Apple Sign-In request not handled');
        }
        if (error.code === 'ERR_REQUEST_NOT_INTERACTIVE') {
          throw new Error('Apple Sign-In request not interactive');
        }

        throw new Error(`Apple Sign-In failed: ${error.message || 'Unknown error'}`);
      }
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

  // Check if OAuth providers are configured and available
  const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID_WEB);
  const isAppleConfigured = Boolean(APPLE_CLIENT_ID) && Platform.OS === 'ios';

  return {
    loginWithGoogle: googleOAuthMutation,
    loginWithApple: appleOAuthMutation,
    isGoogleConfigured,
    isAppleConfigured,
  };
}
