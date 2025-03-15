import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import "../global.css";
import { ApolloProvider } from './components/ApolloProvider';
import { SessionProvider } from './lib/SessionProvider';
import { MainNavigator, NavigationHandler, linking } from './components/Navigators';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
                <NavigationHandler />
              </NavigationContainer>
            </View>
          </SafeAreaProvider>
        </SessionProvider>
      </ApolloProvider>
    </QueryClientProvider>
  );
}