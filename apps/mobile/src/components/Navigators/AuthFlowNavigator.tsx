import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSessionStore } from '../../stores/sessionStore';
import AuthStack from './AuthNavigator';
import CreateProfile from '../../screens/auth/CreateProfile';
import PhoneVerificationFlow from './PhoneVerificationFlow';
import AppNavigator from './AppNavigator';

// Define all possible auth states
export type AuthState = 
  | 'UNAUTHENTICATED'
  | 'NEEDS_PHONE_VERIFICATION'
  | 'NEEDS_PROFILE'
  | 'AUTHENTICATED';

const Stack = createNativeStackNavigator();

export default function AuthFlowNavigator() {
  const { authUser, userProfile } = useSessionStore();
  
  // Determine auth state
  const authState: AuthState = !authUser 
    ? 'UNAUTHENTICATED'
    : !authUser.phone || !authUser.phone_confirmed_at
      ? 'NEEDS_PHONE_VERIFICATION'
      : !userProfile
        ? 'NEEDS_PROFILE'
        : 'AUTHENTICATED';
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {authState === 'UNAUTHENTICATED' && (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
      
      {authState === 'NEEDS_PHONE_VERIFICATION' && (
        <Stack.Screen name="PhoneVerification" component={PhoneVerificationFlow} />
      )}
      
      {authState === 'NEEDS_PROFILE' && (
        <Stack.Screen name="CreateProfile" component={CreateProfile} />
      )}
      
      {authState === 'AUTHENTICATED' && (
        <Stack.Screen name="App" component={AppNavigator} />
      )}
    </Stack.Navigator>
  );
}