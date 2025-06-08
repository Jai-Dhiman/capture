import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { RootStackParamList } from './types';
import AppNavigator from './AppNavigator';
import AuthStack from './AuthNavigator';
import CreateProfile from '@/features/auth/screens/CreateProfile';
import { View, Text, ActivityIndicator } from 'react-native';

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
          CreateProfile: 'auth/create-profile',
          ForgotPassword: 'auth/forgot-password',
          ResetPassword: 'auth/reset-password',
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
    return url;
  },
};

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DCDCDE' }}>
      <ActivityIndicator size="large" color="#000" />
      <Text style={{ marginTop: 20, color: '#333' }}>Loading...</Text>
    </View>
  );
}

export function MainNavigator() {
  const { stage: authStage, session, status } = useAuthStore();

  if (status === 'checking' || status === 'pending') {
    return <LoadingScreen />;
  }

  if (status === 'success' && session) {
    if (authStage === 'profileRequired') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="CreateProfile" component={CreateProfile} />
        </Stack.Navigator>
      );
    }
    return <AppNavigator />;
  }

  return <AuthStack />;
}