import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import GoogleIcon from '../../../assets/icons/GoogleLogo.svg';
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';
import { supabaseAuthClient } from '../../lib/supabaseAuthClient';

export default function OAuth() {
  const { showAlert } = useAlert();

  const handleGoogleSignIn = async () => {
    try {
      const { data, error } = await supabaseAuthClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: Linking.createURL('auth/callback')
        }
      });

      if (error) {
        console.error("OAuth initialization error:", error);
        showAlert(error.message, { type: "error" });
        return;
      }

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
      disabled={false}
    >
      <GoogleIcon width={24} height={24} style={{ marginRight: 16 }} />
      <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
        Log In with Google
      </Text>
    </TouchableOpacity>
  );
}