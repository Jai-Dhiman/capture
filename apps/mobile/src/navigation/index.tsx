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
          Signup: 'auth/signup',
          EmailSignup: 'auth/email-signup',
          CodeVerification: 'auth/code-verification',
          CreateProfile: 'auth/create-profile',
          RegisterScreen: 'auth/register-screen'
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

  // Show loading screen while checking authentication
  if (status === 'checking' || status === 'pending') {
    return <LoadingScreen />;
  }

  // User is authenticated
  if (status === 'success' && session) {
    if (authStage === 'profileRequired') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="CreateProfile" component={CreateProfile} />
        </Stack.Navigator>
      );
    }
    // User is fully authenticated
    return <AppNavigator />;
  }

  // User is not authenticated - show auth stack
  return <AuthStack />;
}
