import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EnterPhoneScreen from '../../screens/auth/EnterPhoneScreen';
import VerifyPhoneNumberScreen from '../../screens/auth/VerifyPhoneNumber';

const Stack = createNativeStackNavigator();

export default function PhoneVerificationFlow() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EnterPhone" component={EnterPhoneScreen} />
      <Stack.Screen name="VerifyPhoneNumber" component={VerifyPhoneNumberScreen} />
    </Stack.Navigator>
  );
}