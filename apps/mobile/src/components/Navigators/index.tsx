import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useAuthStore } from 'stores/authStore';
import { RootStackParamList } from './types/navigation';
import AppNavigator from './AppNavigator';
import AuthStack from './AuthNavigator';
import CreateProfile from '../../screens/auth/CreateProfile';
import { authService } from '../../services/authService';
import { useOnboardingStore } from '../../stores/onboardingStore';
import ImageEditScreen from '../../screens/ImageEditScreen';

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
      Splash: 'splash',
      Auth: {
        screens: {
          Login: 'auth/login',
          Signup: 'auth/signup',
          EmailSignup: 'auth/email-signup',
          CreateProfile: 'auth/create-profile',
          ForgotPassword: 'auth/forgot-password',
          ResetPassword: 'auth/reset-password',
          EmailVerificationPending: 'auth/verify-email'
        }
      },
      App: {
        screens: {
          Feed: 'feed',
          NewPost: 'new-post',
          Profile: 'profile/:userId?',
          Search: 'search',
          Settings: {
            screens: {
              MainSettings: 'settings',
              BlockedUsers: 'settings/blocked-users',
              AccountSettings: 'settings/account',
              VerifyPhone: 'settings/verify-phone',
            }
          }
        }
      },
      CreateProfile: 'create-profile',
      ImageEditScreen: 'image-edit',
    }
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();

    if (url) {
      try {
        const screenName = await authService.handleAuthCallback(url);
        if (screenName) {
          return null;
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
  const [isSplashComplete, setIsSplashComplete] = useState(false);

  useEffect(() => {
    const checkForDeepLink = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        setIsSplashComplete(true);
      }
    };

    checkForDeepLink();
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {authStage === 'unauthenticated' && (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}

      {authStage === 'profile-creation' && (
        <Stack.Screen name="CreateProfile" component={CreateProfile} />
      )}

      {authStage === 'complete' && (
        <Stack.Screen name="App" component={AppNavigator} />
      )}
      <Stack.Screen name="ImageEditScreen" component={ImageEditScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}