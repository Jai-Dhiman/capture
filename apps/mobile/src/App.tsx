import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import "../global.css";
import { ApolloProvider } from './components/ApolloProvider';
import { SessionProvider } from './lib/SessionProvider';
import { MainNavigator, linking } from './components/Navigators';
import { AlertProvider } from './lib/AlertContext';
import {Provider as JotaiProvider } from 'Jotai'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          <ApolloProvider>
            <SessionProvider>
              <AlertProvider>
                <View className="flex-1 bg-black">
                  <StatusBar style="light" />
                  <NavigationContainer linking={linking}>
                    <MainNavigator />
                  </NavigationContainer>
                </View>
              </AlertProvider>
            </SessionProvider>
          </ApolloProvider>
        </QueryClientProvider>
      </JotaiProvider>
    </SafeAreaProvider>
  );
}