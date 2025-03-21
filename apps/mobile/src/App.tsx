import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import "../global.css";
import { ApolloProvider } from './components/providers/ApolloProvider';
import { SessionProvider } from './lib/SessionProvider';
import { MainNavigator, linking } from './components/Navigators';
import { AlertProvider } from './lib/AlertContext';
import { Provider as JotaiProvider } from 'jotai'
import { JotaiInitializer } from './components/providers/JotaiProvider';


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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <JotaiProvider>
          <QueryClientProvider client={queryClient}>
          <JotaiInitializer />
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
    </GestureHandlerRootView>
  );
}