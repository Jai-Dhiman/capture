import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import GoogleIcon from '../../../assets/icons/GoogleLogo.svg';
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';
import { useAuth } from '../../hooks/auth/useAuth';

export default function OAuth() {
  const { showAlert } = useAlert();
  const { oauthSignIn } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      oauthSignIn.mutate('google', {
        onSuccess: async (data) => {
          if (data?.url) {
            console.log("Opening auth session with URL:", data.url);
            
            try {
              const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                Linking.createURL('auth/callback')
              );
              
              console.log("Auth session result:", result.type);
              
            } catch (error) {
              console.error("Error during web browser auth session:", error);
              showAlert("Authentication failed. Please try again.", {
                type: "error"
              });
            }
          } else {
            showAlert("Failed to start Google authentication", {
              type: "error"
            });
          }
        },
        onError: (error) => {
          console.error("OAuth sign-in error:", error);
          const appError = errorService.handleAuthError(error);
          showAlert(appError.message, {
            type: errorService.getAlertType(appError.category)
          });
        }
      });
    } catch (error) {
      console.error("Unexpected error during Google sign-in:", error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category)
      });
    }
  };

  return (
    <TouchableOpacity 
      className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
      onPress={handleGoogleSignIn}
      disabled={oauthSignIn.isPending}
    >
      <GoogleIcon width={24} height={24} style={{ marginRight: 16 }} />
      <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
        {oauthSignIn.isPending ? 'Loading...' : 'Log In with Google'}
      </Text>
    </TouchableOpacity>
  );
}