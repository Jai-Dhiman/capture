import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useAuthStore } from 'stores/authStore';
import { RootStackParamList } from './types/navigation';
import AppNavigator from './AppNavigator';
import AuthStack from './AuthNavigator';
import CreateProfile from '../../screens/auth/CreateProfile';
import PhoneVerificationFlow from './PhoneVerificationFlow';
import { authService } from '../../services/authService';
import { useOnboardingStore } from '../../stores/onboardingStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'), 
    'captureapp://', 
    'https://captureapp.org',
    'http://localhost:8081',
    'exp://192.168.1.64:8081'
  ],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'auth/login',
          Signup: 'auth/signup',
          EmailSignup: 'auth/email-signup',
          EnterPhone: 'auth/verify-email',
          VerifyPhoneNumber: 'auth/verify-phone',
          CreateProfile: 'auth/create-profile',
          ForgotPassword: 'auth/forgot-password',
          ResetPassword: 'auth/reset-password',
        }
      },
      PhoneVerification: {
        screens: {
          EnterPhone: 'verify/phone',
          VerifyPhoneNumber: 'verify/code',
        }
      },
      App: {
        screens: {
          Feed: 'feed',
          NewPost: 'new-post',
          Profile: 'profile/:userId?',
          Search: 'search',
          SavedPosts: 'saved',
        }
      },
      CreateProfile: 'create-profile',
    }
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    
    if (url) {
      try {
        const redirectPath = await authService.handleAuthCallback(url);
        if (redirectPath) {
          return Linking.createURL(redirectPath);
        }
      } catch (error) {
        console.error("Failed to handle deep link:", error);
      }
    }
    
    return url;
  },
};

export function MainNavigator() {
  const { stage: authStage } = useAuthStore();
  const { currentStep } = useOnboardingStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {authStage === 'unauthenticated' && (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
      
      {authStage === 'profile-creation' && (
        <Stack.Screen name="CreateProfile" component={CreateProfile} />
      )}
      
      {authStage === 'phone-verification' && (
        <Stack.Screen name="PhoneVerification" component={PhoneVerificationFlow} />
      )}
      
      {authStage === 'complete' && (
        <Stack.Screen name="App" component={AppNavigator} />
      )}
    </Stack.Navigator>
  );
}