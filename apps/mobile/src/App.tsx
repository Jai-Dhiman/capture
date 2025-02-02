import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import "../global.css";
import { SessionProvider, useSession } from 'lib/supabase';

import Feed from './screens/Feed';
import AuthStack from 'components/Auth';

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator();

function MainNavigator() {
  const { session } = useSession();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {session && session.user ? (
        <Stack.Screen name="Feed" component={Feed} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <NavigationContainer>
          <MainNavigator />
        </NavigationContainer>
      </SessionProvider>
    </QueryClientProvider>
  );
}