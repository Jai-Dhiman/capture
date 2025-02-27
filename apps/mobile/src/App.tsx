import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import "../global.css";
import { useSessionStore } from './stores/sessionStore';
import { RootStackParamList } from './types/navigation';
import AppNavigator from 'components/Navigators/AppNavigator';
import AuthStack from 'components/Navigators/AuthNavigator';
import CreateProfile from './screens/auth/CreateProfile';
import { ApolloProvider } from './components/ApolloProvider';


const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainNavigator() {
  const { authUser, userProfile, isLoading } = useSessionStore();

  // if (isLoading) {
  //   return <LoadingScreen />;
  // }

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
    <ApolloProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <MainNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </ApolloProvider>
  );
}