import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import GoogleIcon from '../../assets/icons/GoogleLogo.svg';
import { useAlert } from '../lib/AlertContext';
import { errorService } from '../services/errorService';

export default function OAuth() {
  const { showAlert } = useAlert();

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error) {
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
    >
      <GoogleIcon width={24} height={24} style={{ marginRight: 16 }} />
      <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
        Log In with Google
      </Text>
    </TouchableOpacity>
  );
}