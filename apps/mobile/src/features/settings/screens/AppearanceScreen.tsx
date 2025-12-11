import type { SettingsStackParamList } from '@/navigation/types';
import { svgToDataUri } from '@/shared/utils/svgUtils';
import { CustomBackIconSvg } from '@assets/icons/svgStrings';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAtom } from 'jotai';
import React from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { type ThemeOption, themeAtom } from '../atoms/themeAtom';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'Appearance'>;

export default function AppearanceScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [selectedTheme, setSelectedTheme] = useAtom(themeAtom);

  const themes: { value: ThemeOption; label: string; description: string }[] = [
    {
      value: 'light',
      label: 'Light',
      description: 'Always use light mode',
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Always use dark mode',
    },
    {
      value: 'system',
      label: 'System',
      description: 'Match your device settings',
    },
  ];

  const handleThemeSelect = (theme: ThemeOption) => {
    setSelectedTheme(theme);
  };

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
        <Text className="flex-1 text-center text-xl font-semibold">Appearance</Text>
      </View>

      <ScrollView className="flex-1 px-4">
        <Text className="text-xs font-semibold text-gray-500 mb-2 px-1">THEME</Text>
        <View className="bg-white rounded-lg mb-4">
          {themes.map((theme, index) => (
            <TouchableOpacity
              key={theme.value}
              className={`p-4 flex-row items-center justify-between ${
                index < themes.length - 1 ? 'border-b border-gray-100' : ''
              }`}
              onPress={() => handleThemeSelect(theme.value)}
            >
              <View className="flex-1 mr-4">
                <Text className="text-sm font-medium">{theme.label}</Text>
                <Text className="text-xs text-gray-500 mt-1">{theme.description}</Text>
              </View>
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  selectedTheme === theme.value
                    ? 'border-[#E4CAC7] bg-[#E4CAC7]'
                    : 'border-gray-300'
                }`}
              >
                {selectedTheme === theme.value && (
                  <View className="w-3 h-3 rounded-full bg-black" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View className="bg-yellow-50 rounded-lg p-4 mb-8 border border-yellow-200">
          <Text className="text-sm font-medium text-yellow-800 mb-1">Coming Soon</Text>
          <Text className="text-xs text-yellow-700">
            Dark mode is currently in development. For now, the app will display in light mode.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
