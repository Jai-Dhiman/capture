import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import GoogleIcon from '@assets/icons/GoogleLogo.svg';
import { useAlert } from '@shared/lib/AlertContext';
import { errorService } from '@shared/services/errorService';
import { supabaseAuthClient, getStoredCodeVerifier } from '../lib/supabaseAuthClient';
import { secureStorage } from '@shared/lib/storage';
import { API_URL } from '@env';

export default function OAuth() {
  const { showAlert } = useAlert();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const checkVerifier = async () => {
      await getStoredCodeVerifier();
    };
    checkVerifier();
  }, []);

  const handleGoogleSignIn = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);

    try {
      await secureStorage.removeItem("sb-cksprfmynsulsqecwngc-auth-token-code-verifier");

      const baseUrl = __DEV__
        ? 'http://localhost:8081'
        : API_URL;
      const redirectUrl = `${baseUrl}/auth/callback`;

      const { data, error } = await supabaseAuthClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        }
      });

      if (error) {
        console.error("OAuth initialization error:", error);
        showAlert(error.message, { type: "error" });
        return;
      }

      await getStoredCodeVerifier();

      if (!data?.url) {
        showAlert("Failed to generate authentication URL", { type: "error" });
        return;
      }

      await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        {
          showInRecents: true,
          preferEphemeralSession: false
        }
      );

      await getStoredCodeVerifier();

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