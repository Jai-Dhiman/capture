import React from 'react';
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
        <View className="w-24 h-24 rounded-full overflow-hidden">
          <SkeletonElement 
            width="100%" 
            height="100%" 
            radius="round" 
          />
        </View>
        
        <View className="ml-4 flex-1 justify-center">
          <SkeletonElement width="60%" height={24} radius={4} />
          <View className="mt-1">
            <SkeletonElement width="90%" height={16} radius={4} />
            <SkeletonElement width="80%" height={16} radius={4} />
          </View>
          
          <View className="flex-row mt-4">
            <View className="mr-2">
              <SkeletonElement 
                width={100} 
                height={32} 
                radius={30} 
              />
            </View>
            <SkeletonElement 
              width={100} 
              height={32} 
              radius={30} 
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row mb-6">
      <View className="w-24 h-24 rounded-full bg-red-200 shadow overflow-hidden">
        {profileData?.profileImage ? (
          <ProfileImage cloudflareId={profileData.profileImage} />
        ) : (
          <View className="w-full h-full bg-stone-300" />
        )}
      </View>
      
      <View className="ml-4 flex-1 justify-center">
        <Text className="text-xl font-light">{profileData?.username || 'User'}</Text>
        <Text className="text-xs font-light text-black opacity-70 mt-1">
          {profileData?.bio || ''}
        </Text>
        
        <View className="flex-row mt-4">
          {isOwnProfile ? (
            <>
              <TouchableOpacity 
                className="bg-neutral-400 rounded-[30px] px-4 py-1 mr-2"
                onPress={onSettingsPress}
              >
                <Text className="text-white text-xs font-normal text-center">Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-[#E4CAC7] rounded-[30px] border border-[#E4CAC7] px-4 py-1"
                onPress={onFollowersPress}
              >
                <Text className="text-black text-xs font-normal text-center">Followers</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <FollowButton 
                userId={userId}
                isFollowing={profileData?.isFollowing ?? false}
                className="bg-neutral-400 rounded-[30px] px-4 py-1 mr-2"
              />
              <TouchableOpacity 
                className="bg-stone-300 rounded-[30px] border border-stone-300 px-4 py-1"
              >
                <Text className="text-black text-xs font-normal text-center">Message</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};