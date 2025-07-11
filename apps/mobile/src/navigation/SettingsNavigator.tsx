import AccountSettingsScreen from '@/features/settings/screens/AccountSettingsScreen';
import BlockedUsersScreen from '@/features/settings/screens/BlockedUsersScreen';
import MainSettingsScreen from '@/features/settings/screens/MainSettingsScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import type { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainSettings" component={MainSettingsScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
    </Stack.Navigator>
  );
}
