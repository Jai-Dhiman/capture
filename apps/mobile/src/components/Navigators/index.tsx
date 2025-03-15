import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { RootStackParamList } from './types/navigation';
import AppNavigator from './AppNavigator';
import AuthStack from './AuthNavigator';
import CreateProfile from '../../screens/auth/CreateProfile';
import PhoneVerificationFlow from './PhoneVerificationFlow';
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
          SinglePost: 'post/:postId',
          Search: 'search',
          SavedPosts: 'saved',
        }
      },
      CreateProfile: 'create-profile',
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

  useEffect(() => {
    console.log("Auth state updated:", { 
      isAuthenticated: !!authUser,
      hasPhone: authUser?.phone && authUser?.phone_confirmed_at,
      hasProfile: !!userProfile,
      isLoading
    });
  }, [authUser, userProfile, isLoading]);

  if (isLoading) {
    return <SplashAnimation fullScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!authUser ? (
        // Not authenticated - show login/signup flow
        <Stack.Screen 
          name="Auth" 
          component={AuthStack} 
          initialParams={{ screen: 'Login' }} 
        />
      ) : !authUser.phone || !authUser.phone_confirmed_at ? (
        // Authenticated but needs phone verification
        <Stack.Screen 
          name="PhoneVerification" 
          component={PhoneVerificationFlow} 
        />
      ) : !userProfile ? (
        // Phone verified but needs profile
        <Stack.Screen 
          name="CreateProfile" 
          component={CreateProfile} 
        />
      ) : (
        // Fully authenticated with profile
        <Stack.Screen 
          name="App" 
          component={AppNavigator} 
        />
      )}
    </Stack.Navigator>
  );
}

export function NavigationHandler() {
  const { authUser, isLoading } = useSessionStore();
  const navigation = useNavigation();

  useEffect(() => {
    if (!isLoading && authUser?.phone === null && authUser?.phone_confirmed_at === null) {
      console.log("NavigationHandler: Redirecting to phone verification");
      (navigation as any).navigate('PhoneVerification', { screen: 'EnterPhone' });
    }
  }, [authUser, navigation, isLoading]);

  return null;
}