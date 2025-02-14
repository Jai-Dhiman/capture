import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import "../global.css";
import { useSessionStore } from './stores/sessionStore';
import { RootStackParamList } from './types/navigation';

import Feed from './screens/Feed';
import AuthStack from 'components/Auth';
import CreateProfile from './screens/auth/CreateProfile';

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
        <Stack.Screen name="Feed" component={Feed} />
      ) : (
        <>
          <Stack.Screen name="Auth" component={AuthStack} />
          <Stack.Screen name="CreateProfile" component={CreateProfile} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  );
}