import EmailCodeVerificationScreen from '@/features/auth/screens/EmailCodeVerificationScreen';
import PhoneCodeVerificationScreen from '@/features/auth/screens/PhoneCodeVerificationScreen';
import CreateProfile from '@/features/auth/screens/CreateProfile';
import EmailSignupScreen from '@/features/auth/screens/EmailSignupScreen';
import LoginScreen from '@/features/auth/screens/LoginScreen';
import RegisterScreen from '@/features/auth/screens/RegisterScreen';
import PasskeySetupScreen from '@/features/auth/screens/PasskeySetupScreen';
import MFACreationScreen from '@/features/auth/screens/MFACreationScreen';
import TOTPSetupScreen from '@/features/auth/screens/TOTPSetupScreen';
import TOTPVerificationScreen from '@/features/auth/screens/TOTPVerificationScreen';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  const authStage = useAuthStore((state) => state.stage);
  console.log('[AUTH_STACK] AuthStack rendering with stage:', authStage);

  // Return different stacks based on auth stage to ensure proper navigation
  if (authStage === 'securitySetupRequired') {
    return (
      <Stack.Navigator
        initialRouteName="PasskeySetup"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="PasskeySetup" component={PasskeySetupScreen} />
        <Stack.Screen name="MFACreation" component={MFACreationScreen} />
        <Stack.Screen name="TOTPSetup" component={TOTPSetupScreen} />
        <Stack.Screen name="TOTPVerification" component={TOTPVerificationScreen} />
        <Stack.Screen name="CreateProfile" component={CreateProfile} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="RegisterScreen" component={RegisterScreen} />
      <Stack.Screen name="EmailSignup" component={EmailSignupScreen} />
      <Stack.Screen name="EmailCodeVerification" component={EmailCodeVerificationScreen} />
      <Stack.Screen name="PhoneCodeVerification" component={PhoneCodeVerificationScreen} />
      <Stack.Screen name="TOTPSetup" component={TOTPSetupScreen} />
      <Stack.Screen name="TOTPVerification" component={TOTPVerificationScreen} />
      <Stack.Screen name="CreateProfile" component={CreateProfile} />
    </Stack.Navigator>
  );
}
