import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from './screens/auth/LoginScreen';
import  SignupScreen from './screens/auth/SignupScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import "../global.css"

const queryClient = new QueryClient()
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerShown: false
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
        />
        <Stack.Screen 
          name="Signup" 
          component={SignupScreen} 
        />
      </Stack.Navigator>
    </NavigationContainer>
    </QueryClientProvider>
  );
}