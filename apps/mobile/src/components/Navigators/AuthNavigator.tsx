import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../../screens/auth/LoginScreen';
import EmailSignupScreen from '../../screens/auth/EmailSignupScreen'
import SignupScreen from '../../screens/auth/SignupScreen';
import { AuthStackParamList } from '../../types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="EmailSignup" component={EmailSignupScreen} />
    </Stack.Navigator>
  );
}