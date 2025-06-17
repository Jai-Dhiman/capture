import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { useMutation } from '@tanstack/react-query';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { pkceStore } from '../lib/pkce';
import { workersAuthApi } from '../lib/workersAuthApi';
import { useAuthStore } from '../stores/authStore';
import type { AuthResponse } from '../types';
import { Platform } from 'react-native';

// Configure WebBrowser for auth session
WebBrowser.maybeCompleteAuthSession();

// OAuth configuration
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const APPLE_CLIENT_ID = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || '';

// Get the appropriate Google client ID based on platform
const getGoogleClientId = (): string => {
  switch (Platform.OS) {
    case 'ios':
      return GOOGLE_IOS_CLIENT_ID;
    case 'android':
      return GOOGLE_ANDROID_CLIENT_ID;
    default:
      return GOOGLE_WEB_CLIENT_ID;
  }
};

// Get appropriate redirect URI based on platform
const getRedirectUri = (): string => {
  // For iOS with Google iOS client, use the iOS URL scheme from Google Cloud Console
  if (Platform.OS === 'ios') {
    return 'com.googleusercontent.apps.562912588429-kjsb2br221rgfnlv11nimbsom1n69ju0://oauth';
  }
  // For other platforms, use Expo's default
  return AuthSession.makeRedirectUri();
};

export function useOAuth() {
  const { showAlert } = useAlert();
  const setAuthData = useAuthStore((state) => state.setAuthData);

  // Google OAuth with PKCE
  const googleOAuthMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      if (!getGoogleClientId()) {
        throw new Error('Google OAuth not configured');
      }

      // Generate PKCE parameters
      const pkceParams = await pkceStore.storePKCEParams('google');
      const redirectUri = getRedirectUri();

      // Debug logging
      console.log('🔍 Google OAuth Debug:', {
        platform: Platform.OS,
        clientId: getGoogleClientId(),
        redirectUri,
        codeChallenge: pkceParams.codeChallenge,
        state: pkceParams.state,
      });

      // Test PKCE implementation locally before sending to Google
      try {
        const { generateCodeChallenge } = await import('../lib/pkce');
        const testChallenge = await generateCodeChallenge(pkceParams.codeVerifier);

        if (pkceParams.codeChallenge !== testChallenge) {
          throw new Error('PKCE verification failed - challenges do not match!');
        }
      } catch (verifyError) {
        console.error('❌ PKCE verification failed:', verifyError);
        throw new Error(
          `PKCE implementation error: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`,
        );
      }

      // Manual OAuth URL construction (WebBrowser method)
      const manualOAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      manualOAuthUrl.searchParams.set('client_id', getGoogleClientId());
      manualOAuthUrl.searchParams.set('redirect_uri', redirectUri);
      manualOAuthUrl.searchParams.set('response_type', 'code');
      manualOAuthUrl.searchParams.set('scope', 'openid profile email');
      manualOAuthUrl.searchParams.set('state', pkceParams.state);
      manualOAuthUrl.searchParams.set('code_challenge', pkceParams.codeChallenge);
      manualOAuthUrl.searchParams.set('code_challenge_method', 'S256');
      manualOAuthUrl.searchParams.set('access_type', 'offline');

      // Use WebBrowser for OAuth (works correctly with PKCE)
      const browserResult = await WebBrowser.openAuthSessionAsync(
        manualOAuthUrl.toString(),
        redirectUri,
      );

      if (browserResult.type === 'success' && browserResult.url) {
        const resultUrl = new URL(browserResult.url);
        const code = resultUrl.searchParams.get('code');
        const state = resultUrl.searchParams.get('state');

        if (!code) {
          throw new Error('No authorization code received from Google');
        }

        if (state !== pkceParams.state) {
          throw new Error('State parameter mismatch - potential security issue');
        }

        // Exchange authorization code for tokens using our backend
        const authResponse = await workersAuthApi.oauthGoogle({
          code,
          codeVerifier: pkceParams.codeVerifier,
          redirectUri,
          clientId: getGoogleClientId(),
        });

        pkceStore.clearPKCEParams('google');
        return authResponse;
      }

      throw new Error(
        `OAuth authentication ${browserResult.type === 'cancel' ? 'was cancelled' : 'failed'}`,
      );
    },
    onSuccess: (data) => {
      setAuthData(data);
      showAlert('Successfully signed in with Google!', { type: 'success' });
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      pkceStore.clearPKCEParams('google'); // Clean up on error
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Apple OAuth
  const appleOAuthMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      if (!APPLE_CLIENT_ID) {
        throw new Error('Apple OAuth not configured');
      }

      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Use mobile-appropriate redirect URI
      const redirectUri = Platform.OS === 'ios' 
        ? 'com.captureapp.mobile://oauth'
        : AuthSession.makeRedirectUri();

      console.log('🍎 Apple OAuth Debug:', {
        platform: Platform.OS,
        redirectUri,
        appleClientId: APPLE_CLIENT_ID
      });

      // Apple OAuth URL construction
      const appleOAuthUrl = new URL('https://appleid.apple.com/auth/authorize');
      appleOAuthUrl.searchParams.set('client_id', APPLE_CLIENT_ID);
      appleOAuthUrl.searchParams.set('redirect_uri', redirectUri);
      appleOAuthUrl.searchParams.set('response_type', 'code id_token');
      appleOAuthUrl.searchParams.set('scope', 'openid');
      appleOAuthUrl.searchParams.set('response_mode', 'fragment');
      appleOAuthUrl.searchParams.set('state', state);

      const browserResult = await WebBrowser.openAuthSessionAsync(
        appleOAuthUrl.toString(),
        redirectUri,
      );

      if (browserResult.type === 'success' && browserResult.url) {
        const resultUrl = new URL(browserResult.url);
        
        // Handle fragment-based response
        const fragment = resultUrl.hash.substring(1);
        const params = new URLSearchParams(fragment);

        const code = params.get('code');
        const identityToken = params.get('id_token');
        const returnedState = params.get('state');

        if (!identityToken) {
          throw new Error('No identity token received from Apple');
        }

        if (returnedState !== state) {
          throw new Error('State parameter mismatch - potential security issue');
        }

        // Exchange identity token using your backend
        const authResponse = await workersAuthApi.oauthApple({
          code: code || '',
          identityToken,
        });

        return authResponse;
      }

      throw new Error(
        `Apple OAuth authentication ${browserResult.type === 'cancel' ? 'was cancelled' : 'failed'}`,
      );
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
  const isGoogleConfigured = Boolean(getGoogleClientId());
  const isAppleConfigured = Boolean(APPLE_CLIENT_ID);

  return {
    loginWithGoogle: googleOAuthMutation,
    loginWithApple: appleOAuthMutation,
    isGoogleConfigured,
    isAppleConfigured,
  };
}
