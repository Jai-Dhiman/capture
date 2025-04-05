import React, { useState } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import GoogleIcon from '../../../assets/icons/GoogleLogo.svg';
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';
import { supabaseAuthClient, getStoredCodeVerifier } from '../../lib/supabaseAuthClient';

export default function OAuth() {
  const { showAlert } = useAlert();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    
    try {
      const existingVerifier = await getStoredCodeVerifier();
      console.log("Existing code verifier before auth flow:", existingVerifier);
      
      const { data, error } = await supabaseAuthClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: Linking.createURL('auth/callback'),
          skipBrowserRedirect: true,
        }
      });

      if (error) {
        console.error("OAuth initialization error:", error);
        showAlert(error.message, { type: "error" });
        return;
      }

      const generatedVerifier = await getStoredCodeVerifier();
      console.log("Generated code verifier after OAuth init:", generatedVerifier);

      if (!data?.url) {
        showAlert("Failed to generate authentication URL", { type: "error" });
        return;
      }

      console.log("Opening auth session with URL:", data.url);
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        Linking.createURL('auth/callback')
      );
      
      console.log("Auth session result:", result.type);
      
      const persistedVerifier = await getStoredCodeVerifier();
      console.log("Persisted code verifier after WebBrowser closed:", persistedVerifier);
      
    } catch (error) {
      console.error("Unexpected error during Google sign-in:", error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category)
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <TouchableOpacity 
      className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
      onPress={handleGoogleSignIn}
      disabled={isAuthenticating}
    >
      <GoogleIcon width={24} height={24} style={{ marginRight: 16 }} />
      <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
        {isAuthenticating ? "Authenticating..." : "Log In with Google"}
      </Text>
    </TouchableOpacity>
  );
}