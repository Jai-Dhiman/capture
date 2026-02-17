import type { SettingsStackParamList } from '@/navigation/types';
import { svgToDataUri } from '@/shared/utils/svgUtils';
import { CustomBackIconSvg } from '@assets/icons/svgStrings';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  type NotificationSettingsInput,
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '../hooks/useNotificationSettings';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'NotificationSettings'>;

type SettingKey = keyof NotificationSettingsInput;

interface SettingConfig {
  key: SettingKey;
  label: string;
  description: string;
}

const NOTIFICATION_TYPES: SettingConfig[] = [
  {
    key: 'likes',
    label: 'Likes',
    description: 'When someone likes your post',
  },
  {
    key: 'comments',
    label: 'Comments',
    description: 'When someone comments on your post',
  },
  {
    key: 'follows',
    label: 'New Followers',
    description: 'When someone follows you',
  },
  {
    key: 'mentions',
    label: 'Mentions',
    description: 'When someone mentions you',
  },
  {
    key: 'saves',
    label: 'Saves',
    description: 'When someone saves your post',
  },
];

export default function NotificationSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { data: settings, isLoading } = useNotificationSettings();
  const { mutate: updateSettings } = useUpdateNotificationSettings();

  const toggleSetting = (key: SettingKey) => {
    if (!settings) return;
    const currentValue = settings[key];
    updateSettings({ [key]: !currentValue });
  };

  const pushEnabled = settings?.enablePush ?? true;

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#DCDCDE]">
        <StatusBar barStyle="dark-content" />
        <View className="w-full pt-14 px-4 pb-4 flex-row items-center">
          <TouchableOpacity
            className="absolute left-4 top-14 w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
            onPress={() => navigation.goBack()}
          >
            <Image
              source={{ uri: svgToDataUri(CustomBackIconSvg) }}
              style={{ width: 30, height: 30 }}
            />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-semibold">Notifications</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#E4CAC7" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#DCDCDE]">
      <StatusBar barStyle="dark-content" />

      <View className="w-full pt-14 px-4 pb-4 flex-row items-center">
        <TouchableOpacity
          className="absolute left-4 top-14 w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
          onPress={() => navigation.goBack()}
        >
          <Image
            source={{ uri: svgToDataUri(CustomBackIconSvg) }}
            style={{ width: 30, height: 30 }}
          />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-xl font-semibold">Notifications</Text>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Master Toggle */}
        <View className="bg-white rounded-lg p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-sm font-semibold">Push Notifications</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Receive push notifications on your device
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={() => toggleSetting('enablePush')}
              trackColor={{ false: '#d4d4d4', true: '#E4CAC7' }}
              thumbColor={pushEnabled ? '#000000' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Individual Settings */}
        <Text className="text-xs font-semibold text-gray-500 mb-2 px-1">NOTIFICATION TYPES</Text>
        <View className="bg-white rounded-lg mb-4">
          {NOTIFICATION_TYPES.map((setting, index) => {
            const isEnabled = settings?.[setting.key] ?? true;
            return (
              <View
                key={setting.key}
                className={`p-4 flex-row items-center justify-between ${
                  index < NOTIFICATION_TYPES.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <View className="flex-1 mr-4">
                  <Text className="text-sm font-medium">{setting.label}</Text>
                  <Text className="text-xs text-gray-500 mt-1">{setting.description}</Text>
                </View>
                <Switch
                  value={isEnabled && pushEnabled}
                  onValueChange={() => toggleSetting(setting.key)}
                  trackColor={{ false: '#d4d4d4', true: '#E4CAC7' }}
                  thumbColor={isEnabled && pushEnabled ? '#000000' : '#f4f3f4'}
                  disabled={!pushEnabled}
                />
              </View>
            );
          })}
        </View>

        <Text className="text-xs text-gray-500 px-1 mb-8">
          Note: You can change these settings at any time. Disabling push notifications will prevent
          all notifications from appearing on your device.
        </Text>
      </ScrollView>
    </View>
  );
}
