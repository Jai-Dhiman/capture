import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { RootStackParamList } from './types/navigation';
import AppNavigator from './AppNavigator';
import AuthStack from './AuthNavigator';
import CreateProfile from '../../screens/auth/CreateProfile';
import { useSessionStore } from '../../stores/sessionStore';
import { useNavigation } from '@react-navigation/native';
import { SplashAnimation } from '../animation/SplashAnimation';
import { supabase } from '../../lib/supabase';

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
        }
      },
      App: {
        screens: {
          Feed: 'feed',
          NewPost: 'new-post',
          Profile: 'profile/:userId?',
          SinglePost: 'post/:postId',
          Search: 'search',
          SavedPosts: 'saved',
        }
      },
      CreateProfile: 'create-profile',
      Profile: 'profile',
    }
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    
    if (url != null) {
      if (url.includes('auth/callback')) {
        try {
          const { data, error } = await supabase.auth.getSession();
          
          if (!error && data.session) {
            const authUser = {
              id: data.session.user.id,
              email: data.session.user.email || '',
              phone: data.session.user.phone || '',
              phone_confirmed_at: data.session.user.phone_confirmed_at || undefined,
            };
            useSessionStore.getState().setAuthUser(authUser);
            
            return Linking.createURL('/auth/enter-phone');
          }
        } catch (error) {
          console.error("Error getting session from URL:", error);
        }
      }
    }
    
    return url;
  },
};

export function MainNavigator() {
  const { authUser, userProfile, isLoading } = useSessionStore();

  if (isLoading) {
    return <SplashAnimation fullScreen />;
  }

  return (
    <Stack.Navigator
      initialRouteName="Auth"
      screenOptions={{
        headerShown: false,
      }}
    >
      {authUser ? (
        authUser.phone && authUser.phone_confirmed_at ? (
          userProfile ? (
            <Stack.Screen 
              name="App" 
              component={AppNavigator} 
              initialParams={{ screen: 'Feed' }} 
            />
          ) : (
            <Stack.Screen name="CreateProfile" component={CreateProfile} />
          )
        ) : (
          <Stack.Screen 
            name="Auth" 
            component={AuthStack} 
            initialParams={{ screen: 'Login', params: { showPhoneVerification: true } }} 
          />
        )
      ) : (
        <Stack.Screen 
          name="Auth" 
          component={AuthStack} 
          initialParams={{ screen: 'Login' }} 
        />
      )}
    </Stack.Navigator>
  );
}

export function NavigationHandler() {
  const { authUser, isLoading } = useSessionStore();
  const navigation = useNavigation();

  useEffect(() => {
    if (!isLoading && authUser?.needsPhoneVerification) {
      (navigation as any).navigate('Auth', { screen: 'EnterPhone' });
    }
  }, [authUser, navigation, isLoading]);

  return null;
}