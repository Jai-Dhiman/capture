import React, { useState } from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { API_URL } from '@env';
import GoogleIcon from '../assets/icons/google.svg';
import { LoadingSpinner } from './LoadingSpinner';

WebBrowser.maybeCompleteAuthSession();

export default function OAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const { setAuthUser } = useSessionStore();
  
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
    <TouchableOpacity 
      className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
      onPress={handleGoogleLogin}
      disabled={isLoading}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <GoogleIcon width={24} height={24} style={{ marginRight: 16 }} />
          <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
            Sign In with Google
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}