import type React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import BackIcon from '../../../assets/icons/CustomBackIcon.svg';
import MenuDots from '../../../assets/icons/CustomMenuIcon.svg';
import { ProfileImage } from '../media/ProfileImage';
import { FollowButton } from './FollowButton';
import { SkeletonElement } from '../ui/SkeletonLoader';

interface ProfileHeaderProps {
  profileData?: any;
  isOwnProfile?: boolean;
  userId?: string;
  onFollowersPress?: () => void;
  onSettingsPress?: () => void;
  isLoading?: boolean;
  showBackButton?: boolean;
  onBackPress?: () => void;
  showMenuButton?: boolean;
  onMenuPress?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profileData,
  isOwnProfile = false,
  userId = '',
  onFollowersPress,
  onSettingsPress,
  isLoading = false,
  showBackButton = false,
  onBackPress,
  showMenuButton = false,
  onMenuPress,
}) => {
  return (
    <View>
      <View className="w-full z-10 bg-[#DCDCDE] flex justify-end" style={{ height: 110 }}>
        <View className="flex-row items-center justify-between px-8 mb-4">
          {showBackButton ? (
            <TouchableOpacity className="w-10 h-10 bg-[#DFD2CD] rounded-full drop-shadow-md flex justify-center items-center"
              style={{ boxShadow: "0 4px 6px rgba(0,0,0,0.2)" }}
              onPress={onBackPress}
            >
              <BackIcon width={28} height={28} />
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10" />
          )}
          <Text className="text-5xl font-light text-center flex-1">
            Capture
          </Text>

          {showMenuButton ? (
            <TouchableOpacity
              className="w-10 h-10 flex justify-center items-center"
              onPress={onMenuPress}
            >
              <MenuDots width={24} height={24} />
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10" />
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-row mb-4 px-6 pt-2">
          <View className="w-28 h-28 rounded-full overflow-hidden shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
            <SkeletonElement width="100%" height="100%" radius="round" />
          </View>
          <View className="ml-4 flex-1 justify-center">
            <View className="flex-row items-center">
              <SkeletonElement width={100} height={24} radius={4} />
              <View className="ml-2">
                <SkeletonElement width={40} height={12} radius={4} />
              </View>
            </View>
            <View className="mt-1">
              <SkeletonElement width="90%" height={14} radius={4} />
              <SkeletonElement width="80%" height={14} radius={4} />
            </View>
            <View className="flex-row mt-3">
              <View className="mr-2">
                <SkeletonElement width={80} height={24} radius={30} />
              </View>
              <SkeletonElement width={64} height={24} radius={30} />
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-row mb-0 px-6 pt-4 bg-[#DCDCDE] pb-4">
          <View className="w-28 h-28 rounded-full bg-[#DCDCDE] drop-shadow-md">
            {profileData?.profileImage ? (
              <ProfileImage cloudflareId={profileData.profileImage} />
            ) : (
              <View className="w-full h-full bg-stone-300" />
            )}
          </View>
          <View className="ml-4 flex-1 justify-center">
            <View className="flex-row items-center">
              <Text className="text-black text-2xl font-light font-['Roboto'] leading-tight">
                {profileData?.username || 'User'}
              </Text>
              {profileData?.isPrivate && (
                <Text className="ml-2 text-black text-sm font-light font-['Roboto'] leading-3">
                  (private)
                </Text>
              )}
            </View>
            <Text className="text-black text-base font-light font-['Roboto'] leading-snug mt-1">
              {profileData?.bio || ''}
            </Text>
            <View className="flex-row mt-3">
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
      )}
    </View>
  );
};