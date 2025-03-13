import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainNavigator() {
  const { authUser, userProfile, isLoading } = useSessionStore();

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Starting up..." />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {authUser ? (
        userProfile ? (
          <Stack.Screen name="App" component={AppNavigator} />
        ) : (
          <Stack.Screen name="CreateProfile" component={CreateProfile} />
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
              <NavigationContainer>
                <MainNavigator />
              </NavigationContainer>
            </View>
          </SafeAreaProvider>
        </SessionProvider>
      </ApolloProvider>
    </QueryClientProvider>
  );
}