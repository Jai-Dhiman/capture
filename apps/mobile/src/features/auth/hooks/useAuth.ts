import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAlert } from "@/shared/lib/AlertContext";
import { errorService } from "@/shared/services/errorService";
import { workersAuthApi } from "../lib/workersAuthApi";
import * as AuthSession from 'expo-auth-session';
import { buildCodeAsync } from 'expo-auth-session/build/PKCE';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { useAuthStore } from "../stores/authStore";
import type { 
  AuthResponse, 
  SendCodeRequest, 
  SendCodeResponse, 
  VerifyCodeRequest,
  BasicSuccessResponse 
} from "../types";

export function useAuth() {
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  
  const setAuthData = useAuthStore((state) => state.setAuthData);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  // Send verification code mutation
  const sendCodeMutation = useMutation<SendCodeResponse, Error, SendCodeRequest>({
    mutationFn: async (data: SendCodeRequest) => {
      return await workersAuthApi.sendCode(data);
    },
    onError: (error) => {
      console.error("Send code error:", error);
      const appError = errorService.handleAuthError(error); 
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Verify code mutation
  const verifyCodeMutation = useMutation<AuthResponse, Error, VerifyCodeRequest>({
    mutationFn: async (data: VerifyCodeRequest) => {
      return await workersAuthApi.verifyCode(data);
    },
    onSuccess: (data) => {
      setAuthData(data); 
      queryClient.invalidateQueries({ queryKey: ["profile"] }); 
    },
    onError: (error) => {
      console.error("Verify code error:", error);
      const appError = errorService.handleAuthError(error); 
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Google OAuth login
  const googleLoginMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      // Generate redirect URI and PKCE codes
      const redirectUri = AuthSession.makeRedirectUri();
      const { codeVerifier, codeChallenge } = await buildCodeAsync();
      const state = crypto.randomUUID();
      const clientId = Constants.manifest.extra.googleClientId as string;
      // Construct Google OAuth URL
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}`;
      // Open browser for auth
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type !== 'success' || !result.url) {
        throw new Error('Google login cancelled or failed');
      }
      // Parse code and state from returned URL
      const returnedUrl = result.url;
      const params = new URL(returnedUrl).searchParams;
      const code = params.get('code');
      const returnedState = params.get('state');
      if (!code || returnedState !== state) {
        throw new Error('Invalid OAuth response');
      }
      return await workersAuthApi.oauthGoogle({ code, codeVerifier, redirectUri });
    },
    onSuccess: (data) => {
      setAuthData(data);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, { type: errorService.getAlertType(appError.category) });
    },
  });

  // Apple OAuth login
  const appleLoginMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      if (!credential.authorizationCode || !credential.identityToken) {
        throw new Error('Apple login failed');
      }
      const code = credential.authorizationCode;
      const identityToken = credential.identityToken;
      return await workersAuthApi.oauthApple({ code, identityToken });
    },
    onSuccess: (data) => {
      setAuthData(data);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => {
      console.error('Apple OAuth error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, { type: errorService.getAlertType(appError.category) });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      await clearAuth(); 
    },
    onSuccess: () => {
      queryClient.clear(); 
      showAlert("You have been logged out.", { type: "info" });
    },
    onError: (error) => {
      console.error("Logout error:", error);
      const appError = errorService.createError(
        "Failed to sign out properly. Your local session is cleared.",
        "auth/logout-error",
        error instanceof Error ? error : undefined
      );
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  return {
    sendCode: sendCodeMutation,
    verifyCode: verifyCodeMutation,
    logout: logoutMutation,
    loginWithGoogle: googleLoginMutation,
    loginWithApple: appleLoginMutation,
  };
}
