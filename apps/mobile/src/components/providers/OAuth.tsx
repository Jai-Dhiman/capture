import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import GoogleIcon from '../../../assets/icons/GoogleLogo.svg';
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';
import { useAuth } from '../../hooks/auth/useAuth';

export default function OAuth() {
  const { showAlert } = useAlert();
  const { oauthSignIn } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      oauthSignIn.mutate('google');
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
      disabled={oauthSignIn.isPending}
    >
      <GoogleIcon width={24} height={24} style={{ marginRight: 16 }} />
      <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
        {oauthSignIn.isPending ? 'Loading...' : 'Log In with Google'}
      </Text>
    </TouchableOpacity>
  );
}