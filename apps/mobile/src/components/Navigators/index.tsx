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
import { View, Text, ActivityIndicator } from 'react-native';

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
      AuthFallback: {
        screens: {
          Login: 'auth-fallback/login',
          Signup: 'auth-fallback/signup',
          EmailSignup: 'auth-fallback/email-signup',
          CreateProfile: 'auth-fallback/create-profile',
          ForgotPassword: 'auth-fallback/forgot-password',
          ResetPassword: 'auth-fallback/reset-password',
          EmailVerificationPending: 'auth-fallback/verify-email'
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
          },
          ImageEditScreen: 'image-edit',
        }
      },
      CreateProfile: 'create-profile',
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
  const { stage: authStage, session, user, status } = useAuthStore();
  const { currentStep } = useOnboardingStore();
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [showTransitionScreen, setShowTransitionScreen] = useState(false);

  useEffect(() => {
    const checkForDeepLink = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        setIsSplashComplete(true);
      }
    };

    checkForDeepLink();
  }, []);

  useEffect(() => {
    if (authStage === 'complete' && status === 'authenticated') {
      setShowTransitionScreen(true);

      const hasToken = !!session?.access_token;

      if (hasToken) {
        setIsTokenReady(true);
        setShowTransitionScreen(false);
      } else {
        const tokenCheckTimer = setTimeout(() => {
          const currentSession = useAuthStore.getState().session;
          const hasTokenNow = !!currentSession?.access_token;

          setIsTokenReady(true);
          setShowTransitionScreen(false);
        }, 800);

        return () => clearTimeout(tokenCheckTimer);
      }
    }
  }, [authStage, status, session]);

  if (showTransitionScreen) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DCDCDE' }}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 20, color: '#333' }}>Loading your feed...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {authStage === 'unauthenticated' && (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}

      {authStage === 'profile-creation' && (
        <Stack.Screen name="CreateProfile" component={CreateProfile} />
      )}

      {authStage === 'complete' && isTokenReady ? (
        <Stack.Screen name="App" component={AppNavigator} />
      ) : (

        <Stack.Screen
          name="AuthFallback"
          component={AuthStack}
        />
      )}
    </Stack.Navigator>
  );
}