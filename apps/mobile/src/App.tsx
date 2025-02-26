import React, { Fragment } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import "../global.css";
import { useSessionStore } from './stores/sessionStore';
import { RootStackParamList } from './types/navigation';
import AppNavigator from 'components/AppNavigator';
import AuthStack from 'components/AuthNavigator';
import CreateProfile from './screens/auth/CreateProfile';
import { ApolloProvider } from 'components/ApolloProvider';


const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainNavigator() {
  const { authUser } = useSessionStore();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {authUser ? (
        <Stack.Screen name="App" component={AppNavigator} />
      ) : (
        <Fragment>
          <Stack.Screen name="Auth" component={AuthStack} />
          <Stack.Screen name="CreateProfile" component={CreateProfile} />
        </Fragment>
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