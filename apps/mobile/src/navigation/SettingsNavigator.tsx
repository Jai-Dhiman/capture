import AccountSettingsScreen from '@/features/settings/screens/AccountSettingsScreen';
import BlockedUsersScreen from '@/features/settings/screens/BlockedUsersScreen';
import MainSettingsScreen from '@/features/settings/screens/MainSettingsScreen';
import ReportBugScreen from '@/features/settings/screens/ReportBugScreen';
import FeatureRequestScreen from '@/features/settings/screens/FeatureRequestScreen';
import PrivacyPolicyScreen from '@/features/settings/screens/PrivacyPolicyScreen';
import NotificationSettingsScreen from '@/features/settings/screens/NotificationSettingsScreen';
import AppearanceScreen from '@/features/settings/screens/AppearanceScreen';
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
      <Stack.Screen name="ReportBug" component={ReportBugScreen} />
      <Stack.Screen name="FeatureRequest" component={FeatureRequestScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
    </Stack.Navigator>
  );
}
