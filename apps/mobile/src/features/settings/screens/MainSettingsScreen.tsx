import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '@navigation/types';
import { useProfileStore } from '@features/profile/stores/profileStore'
import { ProfileImage } from '@features/post/components/ProfileImage';
import { useAuth } from '@features/auth/hooks/useAuth';
import EmptyIcon from '@assets/icons/EmptyIcon.svg';
import BlockIcon from '@assets/icons/BlockIcon.svg';
import AlgorithmIcon from '@assets/icons/AlgorithmIcon.svg';
import LockIcon2 from '@assets/icons/LockIcon2.svg';
import EmailIcon from '@assets/icons/EmailIcon.svg';
import CustomBackIcon from '@assets/icons/CustomBackIcon.svg';
import NotificationIcon from '@assets/icons/NotificationIcon.svg';
import CustomizeIcon from '@assets/icons/CustomizeIcon.svg';
import FontBookIcon from '@assets/icons/FontBookIcon.svg';
import ShieldIcon from '@assets/icons/ShieldIcon.svg';
import AccountIcon from '@assets/icons/AccountIcon.svg';
import UserVerifiedIcon from '@assets/icons/UserVerifiedIcon.svg';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'MainSettings'>;

export default function MainSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useProfileStore();
  const { logout } = useAuth();

  const goBack = () => {
    navigation.getParent()?.navigate('Feed');
  };

  const handleLogout = () => {
    logout.mutate(undefined);
  };

  return (
    <View className="flex-1 bg-[#DCDCDE]">
      <StatusBar barStyle="dark-content" />

      <View className="w-full pt-14 px-4 pb-4">
        <TouchableOpacity
          className="absolute left-4 top-14 w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center z-10"
          onPress={goBack}
          activeOpacity={0.7}
        >
          <CustomBackIcon width={30} height={30} />
        </TouchableOpacity>
        <Text className="text-center text-4xl font-medium">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4">
        <TouchableOpacity
          className="flex-row items-center bg-stone-400 rounded-full p-4 mb-6 shadow"
          onPress={() => navigation.navigate('AccountSettings')}
        >
          <View className="w-14 h-14 rounded-full overflow-hidden shadow-sm">
            {profile?.profileImage ? (
              <ProfileImage cloudflareId={profile.profileImage} />
            ) : (
              <View className="w-full h-full bg-stone-300" />
            )}
          </View>

          <View className="ml-4">
            <Text className="text-sm font-semibold">{profile?.username || 'User'}</Text>
            <Text className="text-xs text-black opacity-70">
              Password & Security, Verification, Account Information
            </Text>
          </View>
        </TouchableOpacity>

        <View className="bg-stone-400 bg-opacity-0 rounded-[10px] shadow border border-black mb-6">
          <TouchableOpacity
            className="flex-row items-center p-3 border-b border-black border-opacity-20"
            onPress={() => navigation.navigate('BlockedUsers')}
          >
            <BlockIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Blocked Profiles</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <EmailIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Private Messaging Preferences</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <AlgorithmIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Algorithm Preferences</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-3">
            <LockIcon2 height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Data & Privacy Policy</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
        </View>

        {/* Customization Section */}
        <View className="bg-white bg-opacity-0 rounded-[10px] shadow border border-black mb-6">
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <NotificationIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Notification Customization</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <CustomizeIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Appearance & Customization</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20" disabled={true}>
            <FontBookIcon height={25} width={25} />
            <View className="ml-4">
              <Text className="text-xs font-bold">Font Customization</Text>
              <Text className="text-[10px] text-black opacity-70">
                This option will be available in a future update
              </Text>
            </View>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
        </View>

        <Text className="text-center text-[10px] opacity-70 mb-4">
          More customization features will be available as the application gets updated.
          Stay tuned to @Capture for more information on what you can expect and when
        </Text>

        {/* Support Section */}
        <View className="bg-white bg-opacity-0 rounded-[10px] shadow border border-black mb-8">
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <ShieldIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Report User</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <AccountIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Report Bug</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-3">
            <UserVerifiedIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Feature Request</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
        </View>

        <View className="bg-white bg-opacity-0 rounded-[10px] shadow border border-black mb-8 mt-2">
          <TouchableOpacity
            className="flex-row items-center p-3"
            onPress={handleLogout}
          >
            <UserVerifiedIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold text-red-600">Logout</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};