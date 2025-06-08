import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import "../global.css";
import { ApolloProvider } from '@/shared/providers/ApolloProvider';
import { MainNavigator, linking } from '@/navigation/index';
import { AlertProvider } from '@/shared/lib/AlertContext';
import { Provider as JotaiProvider } from 'jotai'
import { JotaiInitializer } from '@/shared/providers/JotaiProvider';
import { initializeAuth } from '@/features/auth/stores/authStore';
import { CommentDrawer } from '@/features/comments//components/CommentDrawer';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://74904d3bf1ebb2b0747f5356b0a83624@o4509049381519360.ingest.us.sentry.io/4509049386434560',
  tracePropagationTargets: ["localhost", /^\//, "https://o4509049381519360.ingest.us.sentry.io"],
  tracesSampleRate: 1.0,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export default Sentry.wrap(function App() {
  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <JotaiProvider>
          <QueryClientProvider client={queryClient}>
            <JotaiInitializer />
            <ApolloProvider>
              <AlertProvider>
                <View className="flex-1 bg-black">
                  <StatusBar style="light" />
                  <NavigationContainer linking={linking}>
                    <MainNavigator />
                    <CommentDrawer />
                  </NavigationContainer>
                </View>
              </AlertProvider>
            </ApolloProvider>
          </QueryClientProvider>
        </JotaiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
