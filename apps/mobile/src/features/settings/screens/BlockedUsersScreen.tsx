import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '@/navigation/types';
import { useBlockedUsers, useUnblockUser } from '@/features/profile/hooks/useBlocking';
import { ProfileImage } from '@/features/post/components/ProfileImage';
import { SkeletonLoader, SkeletonElement } from '@/shared/components/SkeletonLoader';
import { EmptyState } from '@/features/feed/components/EmptyState';
import CustomBackIcon from '@assets/icons/CustomBackIcon.svg';
import { format } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'BlockedUsers'>;

export default function BlockedUsersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { data: blockedUsers, isLoading, refetch } = useBlockedUsers();

  const handleUnblock = async (userId: string) => {
    try {
      const unblockMutation = useUnblockUser(userId);
      await unblockMutation.mutateAsync();
      await refetch();
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const goBack = () => {
    navigation.goBack();
  };

  const renderItem = ({ item }: { item: any }) => {
    const blockDate = new Date(item.createdAt);
    const formattedDate = format(blockDate, 'MM/dd/yy');

    return (
      <View className="w-full h-16 bg-[#DCDCDE] flex-row items-center px-2 mb-2">
        <View className="w-12 h-12 rounded-full overflow-hidden bg-stone-400 shadow-sm">
          {item.profileImage ? (
            <ProfileImage cloudflareId={item.profileImage} />
          ) : (
            <View className="w-full h-full bg-stone-400" />
          )}
        </View>

        <View className="ml-4 flex-1">
          <Text className="text-black text-xs font-semibold">
            {item.username}
          </Text>
          <Text className="text-black text-[10px] opacity-80">
            {`Blocked on ${formattedDate}`}
          </Text>
        </View>

        <TouchableOpacity
          className="bg-neutral-400 rounded-[30px] px-4 py-1"
          onPress={() => handleUnblock(item.userId)}
        >
          <Text className="text-white text-xs">Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#DCDCDE]">
      <StatusBar barStyle="dark-content" />

      <View className="w-full pt-14 px-4 pb-4">
        <TouchableOpacity
          className="absolute left-4 top-14 w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
          onPress={goBack}
        >
          <CustomBackIcon width={30} height={30} />
        </TouchableOpacity>
        <Text className="text-center text-3xl font-light">Blocked Accounts</Text>
      </View>

      {isLoading ? (
        <View className="p-4">
          <SkeletonLoader isLoading={true}>
            {Array(5).fill(0).map((_, index) => (
              <View key={index} className="w-full h-16 mb-2">
                <SkeletonElement width="100%" height={64} radius={8} />
              </View>
            ))}
          </SkeletonLoader>
        </View>
      ) : blockedUsers && blockedUsers.length > 0 ? (
        <FlatList
          data={blockedUsers}
          renderItem={renderItem}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : (
        <EmptyState
          title="No Blocked Users"
          message="You haven't blocked any accounts yet."
          icon="block"
        />
      )}
    </View>
  );
}