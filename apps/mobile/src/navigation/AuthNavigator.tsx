import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import LoginScreen from '@features/auth/screens/LoginScreen';
import SignupScreen from '@features/auth/screens/SignupScreen';
import EmailSignupScreen from '@features/auth/screens/EmailSignupScreen';
import CreateProfile from '@features/auth/screens/CreateProfile';
import ForgotPasswordScreen from '@features/auth/screens/ForgotPasswordScreen';
import ResetPasswordScreen from '@features/auth/screens/ResetPasswordScreen';
import EmailVerificationPendingScreen from '@features/auth/screens/EmailVerificationPendingScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="EmailSignup" component={EmailSignupScreen} />
      <Stack.Screen name="EmailVerificationPending" component={EmailVerificationPendingScreen} />
      <Stack.Screen name="CreateProfile" component={CreateProfile} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}