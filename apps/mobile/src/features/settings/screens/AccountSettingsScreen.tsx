import { useAuthStore } from '@/features/auth/stores/authStore';
import { MediaImage } from '@/features/post/components/MediaImage';
import { useProfileStore } from '@/features/profile/stores/profileStore';
import type { SettingsStackParamList } from '@/navigation/types';
import AlgorithmIcon from '@assets/icons/AlgorithmIcon.svg';
import BlockIcon from '@assets/icons/BlockIcon.svg';
import CustomBackIcon from '@assets/icons/CustomBackIcon.svg';
import EmailIcon from '@assets/icons/EmailIcon.svg';
import EmptyIcon from '@assets/icons/EmptyIcon.svg';
import LockIcon2 from '@assets/icons/LockIcon2.svg';
import { API_URL } from '@env';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import { ScrollView, StatusBar, Switch, Text, TouchableOpacity, View } from 'react-native';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'AccountSettings'>;

export default function AccountSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, session } = useAuthStore();
  const { profile } = useProfileStore();
  const [isPrivate, setIsPrivate] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchPrivacySetting = async () => {
      if (!session?.access_token) return;

      try {
        const response = await fetch(`${API_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: `
              query GetProfile($userId: ID!) {
                profile(id: $userId) {
                  isPrivate
                }
              }
            `,
            variables: { userId: user?.id },
          }),
        });

        const data = await response.json();
        if (data.data?.profile?.isPrivate !== undefined) {
          setIsPrivate(data.data.profile.isPrivate);
        }
      } catch (error) {
        console.error('Error fetching privacy setting:', error);
      }
    };

    fetchPrivacySetting();
  }, [user?.id, session]);

  const updatePrivacyMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query: `
            mutation UpdatePrivacySettings($isPrivate: Boolean!) {
              updatePrivacySettings(isPrivate: $isPrivate) {
                id
                isPrivate
              }
            }
          `,
          variables: { isPrivate: newValue },
        }),
      });

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'Failed to update privacy settings');
      }

      return data.data.updatePrivacySettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const handleTogglePrivacy = () => {
    const newValue = !isPrivate;
    setIsPrivate(newValue);
    updatePrivacyMutation.mutate(newValue);
  };

  const goBack = () => {
    navigation.goBack();
  };

  return (
    <View className="flex-1 bg-[#DCDCDE]">
      <StatusBar barStyle="dark-content" />

      <View className="w-full pt-14 px-4 pb-4 flex-row items-center">
        <TouchableOpacity
          className="absolute left-4 top-14 w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
          onPress={goBack}
        >
          <CustomBackIcon width={30} height={30} />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-xl font-semibold">Capture Account</Text>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Profile Section */}
        <View className="items-center my-8">
          <View className="w-20 h-20 rounded-full overflow-hidden shadow-sm mb-4">
            {profile?.profileImage ? (
              <MediaImage media={profile.profileImage} width={80} circle />
            ) : (
              <View className="w-full h-full bg-stone-300" />
            )}
          </View>

          <Text className="text-xl font-semibold text-center">{profile?.username || 'User'}</Text>
          <Text className="text-xs text-center mt-1">{user?.email || ''}</Text>
        </View>

        <View className="bg-stone-400 bg-opacity-0 rounded-[10px] shadow border border-black mb-6">
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <BlockIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Account Information</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <EmailIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Password & 2FA</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <AlgorithmIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">
              Profile Verification (Media Outlet / Business)
            </Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>

          <View className="flex-row items-center justify-between p-3">
            <View className="flex-row items-center">
              <LockIcon2 height={25} width={25} />
              <View className="ml-4">
                <Text className="text-xs font-bold">Account Privacy</Text>
                <Text className="text-[10px] text-black opacity-70">
                  {isPrivate ? 'Private Account' : 'Public Account'}
                </Text>
              </View>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={handleTogglePrivacy}
              trackColor={{ false: '#d4d4d4', true: '#E4CAC7' }}
              thumbColor={isPrivate ? '#000000' : '#f4f3f4'}
              disabled={updatePrivacyMutation.isPending}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
