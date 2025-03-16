import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types/navigation';
import LoginScreen from '../../screens/auth/LoginScreen';
import SignupScreen from '../../screens/auth/SignupScreen';
import EmailSignupScreen from '../../screens/auth/EmailSignupScreen';
import EnterPhoneScreen from '../../screens/auth/EnterPhoneScreen';
import VerifyPhoneNumberScreen from '../../screens/auth/VerifyPhoneNumber';
import CreateProfile from '../../screens/auth/CreateProfile'
// import ResetPasswordScreen from '../../screens/auth/ResetPasswordScreen';

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
      <Stack.Screen name="EnterPhone" component={EnterPhoneScreen} />
      <Stack.Screen name="VerifyPhoneNumber" component={VerifyPhoneNumberScreen} />
      <Stack.Screen name="CreateProfile" component={CreateProfile} />
      {/* <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} /> */}
    </Stack.Navigator>
  );
}