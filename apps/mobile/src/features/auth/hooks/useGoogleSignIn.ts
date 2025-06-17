import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { useMutation } from '@tanstack/react-query';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { workersAuthApi } from '../lib/workersAuthApi';
import { useAuthStore } from '../stores/authStore';
import type { AuthResponse } from '../types';

/**
 * PROPER GOOGLE SIGN-IN IMPLEMENTATION FOR EXPO
 * 
 * The manual OAuth approach with iOS client IDs doesn't work with Expo/React Native.
 * Instead, use @react-native-google-signin/google-signin library.
 * 
 * Steps to implement:
 * 
 * 1. Install the package:
 *    pnpm add @react-native-google-signin/google-signin
 * 
 * 2. Update your environment variables to use WEB client ID:
 *    EXPO_PUBLIC_GOOGLE_CLIENT_ID="562912588429-ia1001urt4gds03e1b47qpefsum2efns.apps.googleusercontent.com"
 * 
 * 3. In Google Cloud Console, configure the WEB client ID with:
 *    - Authorized redirect URIs: Add your bundle ID scheme
 *    - For example: com.captureapp.mobile://oauth
 * 
 * 4. Run expo prebuild --clean and expo run:ios to rebuild
 * 
 * 5. Use this implementation:
 * 
 * import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
 * 
 * GoogleSignin.configure({
 *   webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
 *   offlineAccess: true,
 * });
 * 
 * const signIn = async () => {
 *   try {
 *     await GoogleSignin.hasPlayServices();
 *     const userInfo = await GoogleSignin.signIn();
 *     const { idToken } = await GoogleSignin.getTokens();
 *     // Send idToken to your backend for verification
 *   } catch (error) {
 *     // Handle errors
 *   }
 * };
 */

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID, // Use web client ID for all platforms
  offlineAccess: true, // if you want to access Google API on behalf of the user FROM YOUR SERVER
  forceCodeForRefreshToken: true, // [Android] if you want to force code for refresh token
});

export function useGoogleSignIn() {
  const { showAlert } = useAlert();
  const setAuthData = useAuthStore((state) => state.setAuthData);

  const googleSignInMutation = useMutation<AuthResponse, Error, void>({
    mutationFn: async () => {
      try {
        // Check if device supports Google Play Services
        await GoogleSignin.hasPlayServices();
        
        // Sign in with Google
        const userInfo = await GoogleSignin.signIn();
        
        // Get tokens
        const { accessToken, idToken } = await GoogleSignin.getTokens();
        
        // Send to your backend for authentication
        // You'll need to update your backend to handle Google Sign-In tokens
        const authResponse = await workersAuthApi.oauthGoogleSignIn({
          idToken,
          accessToken,
          userInfo: userInfo.user,
        });

        return authResponse;
      } catch (error: any) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          throw new Error('Sign in was cancelled');
        }
        if (error.code === statusCodes.IN_PROGRESS) {
          throw new Error('Sign in is already in progress');
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          throw new Error('Google Play Services not available');
        }
        throw new Error(`Google Sign-In failed: ${error.message}`);
      }
    },
    onSuccess: (data) => {
      setAuthData(data);
      showAlert('Successfully signed in with Google!', { type: 'success' });
    },
    onError: (error) => {
      console.error('Google Sign-In error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  const signOut = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('Google Sign-Out error:', error);
    }
  };

  const isConfigured = Boolean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);

  return {
    signIn: googleSignInMutation,
    signOut,
    isConfigured,
  };
}

export const IMPLEMENTATION_NOTES = {
  problem: "iOS OAuth clients don't work with Expo/React Native apps",
  solution: "Use @react-native-google-signin/google-signin with web client ID",
  clientIdType: "Web Client ID (not iOS Client ID)",
  setupRequired: ["Install package", "Update app.json plugin", "Rebuild app"]
}; 