import CreateProfile from '@/features/auth/screens/CreateProfile';
import { initializeAuth, useAuthStore } from '@/features/auth/stores/authStore';
import type { LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import AppNavigator from './AppNavigator';
import AuthStack from './AuthNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    'captureapp://',
    'https://captureapp.org',
    'http://localhost:8081',
  ],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'auth/login',
          RegisterScreen: 'auth/register',
          EmailSignup: 'auth/email-signup',
          EmailCodeVerification: 'auth/email-verification',
          PhoneCodeVerification: 'auth/phone-verification',
          PasskeySetup: 'auth/passkey-setup',
          MFACreation: 'auth/mfa-setup',
          CreateProfile: 'auth/create-profile',
        },
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
            },
          },
          ImageEditScreen: 'image-edit',
        },
      },
      CreateProfile: 'create-profile',
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return url;
  },
};

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#DCDCDE',
      }}
    >
      <ActivityIndicator size="large" color="#000" />
      <Text style={{ marginTop: 20, color: '#333', fontFamily: 'Roboto' }}>Loading...</Text>
    </View>
  );
}

export function MainNavigator() {
  const { stage: authStage, session, status } = useAuthStore();

  // Initialize auth system on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Log navigation decisions
  useEffect(() => {
    console.log('[NAVIGATION] Main navigator state changed:', {
      authStage,
      hasSession: !!session,
      status,
      timestamp: new Date().toISOString()
    });
  }, [authStage, session, status]);

  // Create a unique key that forces re-mount when auth state changes significantly
  const navigationKey = `${authStage}-${!!session}-${status}`;

  // Show loading screen while checking authentication
  if (status === 'checking' || status === 'pending') {
    console.log('[NAVIGATION] Showing loading screen - status:', status);
    return <LoadingScreen />;
  }

  // User is authenticated
  if (status === 'success' && session) {
    if (authStage === 'profileRequired') {
      console.log('[NAVIGATION] Showing profile creation screen');
      return (
        <Stack.Navigator key={navigationKey} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="CreateProfile" component={CreateProfile} />
        </Stack.Navigator>
      );
    }
    if (authStage === 'securitySetupRequired') {
      console.log('[NAVIGATION] Showing auth stack for security setup (PasskeySetupScreen)');
      return <AuthStack key={navigationKey} />;
    }
    // User is fully authenticated
    console.log('[NAVIGATION] Showing main app navigator');
    return <AppNavigator key={navigationKey} />;
  }

  // User is not authenticated - show auth stack
  console.log('[NAVIGATION] Showing auth stack for unauthenticated user');
  return <AuthStack key={navigationKey} />;
}
