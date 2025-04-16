import type React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ProfileImage } from '../media/ProfileImage';
import { FollowButton } from './FollowButton';
import { SkeletonElement } from '../ui/SkeletonLoader';

interface ProfileHeaderProps {
  profileData: any;
  isOwnProfile: boolean;
  userId: string;
  onFollowersPress: () => void;
  onSettingsPress?: () => void;
  isLoading?: boolean;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profileData,
  isOwnProfile,
  userId,
  onFollowersPress,
  onSettingsPress,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <View className="flex-row mb-6">
        <View className="w-24 h-24 rounded-full overflow-hidden shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
          <SkeletonElement
            width="100%"
            height="100%"
            radius="round"
          />
        </View>

        <View className="ml-4 flex-1 justify-center">
          <View className="flex-row items-center">
            <SkeletonElement width={80} height={20} radius={4} />
            <View className="ml-2">
              <SkeletonElement width={40} height={12} radius={4} />
            </View>
          </View>
          <View className="mt-1">
            <SkeletonElement width="90%" height={14} radius={4} />
            <SkeletonElement width="80%" height={14} radius={4} />
          </View>

          <View className="flex-row mt-4">
            <View className="mr-2">
              <SkeletonElement
                width={80}
                height={24}
                radius={30}
              />
            </View>
            <SkeletonElement
              width={64}
              height={24}
              radius={30}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row mb-2" >
      <View className="w-24 h-24 rounded-full bg-red-200 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden">
        {profileData?.profileImage ? (
          <ProfileImage cloudflareId={profileData.profileImage} />
        ) : (
          <View className="w-full h-full bg-stone-300" />
        )}
      </View>

      <View className="ml-4 flex-1 justify-center">
        <View className="flex-row items-center">
          <Text className="text-black text-xl font-light font-['Roboto'] leading-tight">
            {profileData?.username || 'User'}
          </Text>
          {profileData?.isPrivate && (
            <Text className="ml-2 text-black text-xs font-light font-['Roboto'] leading-3">
              (private)
            </Text>
          )}
        </View>

        <Text className="text-black text-xs font-light font-['Roboto'] leading-snug mt-1">
          {profileData?.bio || ''}
        </Text>

        <View className="flex-row mt-4">
          {isOwnProfile ? (
            <>
              <TouchableOpacity
                className="bg-neutral-400 rounded-[30px] h-6 w-24 mr-2 flex items-center justify-center"
                onPress={onSettingsPress}
              >
                <Text className="text-white text-xs font-normal font-['Roboto'] leading-3 text-center">
                  Settings
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-[#e4cac7] rounded-[30px] border border-stone-300 h-6 w-20 flex items-center justify-center"
                onPress={onFollowersPress}
              >
                <Text className="text-black text-xs font-normal font-['Roboto'] leading-3 text-center">
                  Followers
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <FollowButton
                userId={userId}
                isFollowing={profileData?.isFollowing ?? false}
                className="rounded-[30px] h-6 mr-2 flex items-center justify-center"
              />
              <TouchableOpacity
                className="bg-stone-300 rounded-[30px] border border-stone-300 h-6 w-16 flex items-center justify-center"
              >
                <Text className="text-black text-xs font-normal font-['Roboto'] leading-3 text-center">
                  Message
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};