import { useMutation } from "@tanstack/react-query";
import { Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAlert } from "@/shared/lib/AlertContext";
import { errorService } from "@/shared/services/errorService";
import { workersAuthApi } from "../lib/workersAuthApi";
import { useAuthStore } from "../stores/authStore";
import { pkceStore } from "../lib/pkce";
import type { AuthResponse } from "../types";

// Configure WebBrowser for auth session
WebBrowser.maybeCompleteAuthSession();

// OAuth configuration
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const APPLE_CLIENT_ID = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || '';

export function useOAuth() {
  const { showAlert } = useAlert();
  const setAuthData = useAuthStore((state) => state.setAuthData);

  // Google OAuth with PKCE
  const googleOAuthMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      if (!GOOGLE_CLIENT_ID) {
        throw new Error('Google OAuth not configured');
      }

      // Generate PKCE parameters
      const pkceParams = await pkceStore.storePKCEParams('google');
      const redirectUri = AuthSession.makeRedirectUri();

      // Test PKCE implementation locally before sending to Google
      try {
        const { generateCodeChallenge } = await import('../lib/pkce');
        const testChallenge = await generateCodeChallenge(pkceParams.codeVerifier);
        
        if (pkceParams.codeChallenge !== testChallenge) {
          throw new Error('PKCE verification failed - challenges do not match!');
        }
      } catch (verifyError) {
        console.error('❌ PKCE verification failed:', verifyError);
        throw new Error(`PKCE implementation error: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
      }

      // Manual OAuth URL construction (WebBrowser method)
      const manualOAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      manualOAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
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
        redirectUri
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
        });

        pkceStore.clearPKCEParams('google');
        return authResponse;
      }

      throw new Error(`OAuth authentication ${browserResult.type === 'cancel' ? 'was cancelled' : 'failed'}`);
    },
    onSuccess: (data) => {
      setAuthData(data);
      showAlert("Successfully signed in with Google!", { type: "success" });
    },
    onError: (error) => {
      console.error("Google OAuth error:", error);
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

      // Apple Sign In doesn't use PKCE, but uses identity tokens
      const request = new AuthSession.AuthRequest({
        clientId: APPLE_CLIENT_ID,
        scopes: ['name', 'email'],
        redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
        responseType: AuthSession.ResponseType.Code,
        additionalParameters: {
          response_mode: 'form_post',
        },
      });

      // Perform Apple OAuth flow
      const result = await request.promptAsync({
        authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
        useProxy: true,
      });

      if (result.type !== 'success') {
        throw new Error('Apple OAuth was cancelled or failed');
      }

      // For Apple, we need to handle the identity token
      // This is a simplified implementation - in production you'd use Apple's SDK
      const identityToken = result.params.id_token;
      if (!identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Exchange identity token using our backend
      const authResponse = await workersAuthApi.oauthApple({
        code: result.params.code,
        identityToken,
      });

      return authResponse;
    },
    onSuccess: (data) => {
      setAuthData(data);
      showAlert("Successfully signed in with Apple!", { type: "success" });
    },
    onError: (error) => {
      console.error("Apple OAuth error:", error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Check if OAuth providers are configured
  const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID);
  const isAppleConfigured = Boolean(APPLE_CLIENT_ID);

  return {
    loginWithGoogle: googleOAuthMutation,
    loginWithApple: appleOAuthMutation,
    isGoogleConfigured,
    isAppleConfigured,
  };
} 