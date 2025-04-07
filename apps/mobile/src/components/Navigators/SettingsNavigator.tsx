import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsStackParamList } from './types/navigation';
import MainSettingsScreen from '../../screens/settings/MainSettingsScreen';
import BlockedUsersScreen from '../../screens/settings/BlockedUsersScreen';
import AccountSettingsScreen from '../../screens/settings/AccountSettingsScreen';
import VerifyPhoneScreen from '../../screens/settings/VerifyPhoneNumber';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainSettings" component={MainSettingsScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="VerifyPhone" component={VerifyPhoneScreen} />
    </Stack.Navigator>
  );
}