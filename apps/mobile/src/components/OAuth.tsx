import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { GOOGLE_CLIENT_ID, API_URL } from '@env';
import GoogleIcon from '../assets/icons/google.svg';

WebBrowser.maybeCompleteAuthSession();

export default function OAuth() {
  const [authLoading, setAuthLoading] = useState(false);
  
  // Log the client ID being used
  console.log("Google Client ID:", GOOGLE_CLIENT_ID);
  
  // Set up the Google auth request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    // You can try using the web client ID specifically
    // webClientId: GOOGLE_CLIENT_ID,
  });
  
  React.useEffect(() => {
    if (response?.type === 'success') {
      console.log("Success! Got token:", response.params.id_token?.substring(0, 20) + "...");
      // Further authentication logic here
    } else if (response) {
      console.log("Response type:", response.type);
      console.log("Full response:", JSON.stringify(response, null, 2));
    }
  }, [response]);
  
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'capture://'
        }
      });
      
      if (error) throw error;
      
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          'capture://'
        );
        
        if (result.type === 'success') {
          // The user has been redirected back to your app
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user) {
            setAuthUser({
              id: sessionData.session.user.id,
              email: sessionData.session.user.email || '',
            });
            
            const response = await fetch(`${API_URL}/api/profile/check/${sessionData.session.user.id}`, {
              headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
            });
            
            const profileData = await response.json();
            if (!profileData.exists) {
              navigation.navigate('CreateProfile' as never);
            }
          }
        }
      }
    } catch (error) {
      console.error('Google login error:', error);
      Alert.alert('Error', 'Failed to login with Google');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <View>
      <TouchableOpacity 
        className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
        onPress={handleGoogleLogin}
        disabled={!request || authLoading}
      >
        <GoogleIcon width={24} height={24} style={{ marginRight: 7 }} />
        <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
          Continue with Google {authLoading ? "(Loading...)" : ""}
        </Text>
      </TouchableOpacity>
    </View>
  );
}