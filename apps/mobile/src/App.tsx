import React, { useEffect } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import "../global.css";
import { useSessionStore } from './stores/sessionStore';
import { RootStackParamList } from './types/navigation';
import AppNavigator from 'components/Navigators/AppNavigator';
import AuthStack from 'components/Navigators/AuthNavigator';
import CreateProfile from './screens/auth/CreateProfile';
import { ApolloProvider } from './components/ApolloProvider';
import { SessionProvider } from './lib/SessionProvider';
import { LoadingSpinner } from 'components/LoadingSpinner';
import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { supabase } from './lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'http://localhost:8081'],
  config: {
    screens: {
      Auth: {
        screens: {
          EnterPhone: 'auth/verify-email',
        },
      },
    },
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

const Stack = createNativeStackNavigator<RootStackParamList>();


function MainNavigator() {
  const { authUser, userProfile, isLoading } = useSessionStore();
  const navigation = useNavigation();

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Starting up..." />;
  }

  useEffect(() => {
    if (authUser?.needsPhoneVerification) {
      (navigation as any).navigate('Auth', { screen: 'EnterPhone' });
    }
  }, [authUser, navigation]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {authUser ? (
        authUser.phone && authUser.phone_confirmed_at ? (
          userProfile ? (
            <Stack.Screen name="App" component={AppNavigator} />
          ) : (
            <Stack.Screen name="CreateProfile" component={CreateProfile} />
          )
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} initialParams={{ showPhoneVerification: true }} />
        )
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApolloProvider>
        <SessionProvider>
          <SafeAreaProvider>
            <View className="flex-1 bg-black">
              <StatusBar style="light" />
              <NavigationContainer linking={linking}>
                <MainNavigator />
              </NavigationContainer>
            </View>
          </SafeAreaProvider>
        </SessionProvider>
      </ApolloProvider>
    </QueryClientProvider>
  );
}