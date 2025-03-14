// src/components/OAuth.tsx
import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { useSessionStore } from '../stores/sessionStore';
import GoogleIcon from '../../assets/icons/GoogleLogo.svg';

export default function OAuth() {
  const navigation = useNavigation();
  const { setAuthUser } = useSessionStore();

  const handleGoogleSignIn = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // This will trigger redirect to Google
      // On return, handle in App.tsx or a deep link handler
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to sign in with Google'
      
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <TouchableOpacity 
      className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
      onPress={handleGoogleSignIn}
    >
      <GoogleIcon width={24} height={24} style={{ marginRight: 16 }} />
      <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
        Sign In with Google
      </Text>
    </TouchableOpacity>
  );
}