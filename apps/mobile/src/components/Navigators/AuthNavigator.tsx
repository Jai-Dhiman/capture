import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types/navigation';
import LoginScreen from '../../screens/auth/LoginScreen';
import SignupScreen from '../../screens/auth/SignupScreen';
import EmailSignupScreen from '../../screens/auth/EmailSignupScreen';
import VerifyPhoneNumberScreen from '../../screens/settings/VerifyPhoneNumber';
import CreateProfile from '../../screens/auth/CreateProfile';
import ForgotPasswordScreen from '../../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../../screens/auth/ResetPasswordScreen';
import EmailVerificationPendingScreen from 'screens/auth/EmailVerificationPendingScreen';

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
      <Stack.Screen name="VerifyPhoneNumber" component={VerifyPhoneNumberScreen} />
      <Stack.Screen name="CreateProfile" component={CreateProfile} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}