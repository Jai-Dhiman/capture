import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ProfileImage } from '../media/ProfileImage';
import { FollowButton } from './FollowButton';
import { AutoSkeletonView } from 'react-native-auto-skeleton';

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
  return (
    <AutoSkeletonView isLoading={isLoading}>
      <View className="flex-row mb-4">
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
                  className="bg-stone-300 rounded-[30px] border border-stone-300 px-4 py-1"
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
    </AutoSkeletonView>
  );
};