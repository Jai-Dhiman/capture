import { NotificationButton } from '@/features/notification/components/NotificationButton';
import { MediaImage } from '@/features/post/components/MediaImage';
import { SkeletonElement } from '@/shared/components/SkeletonLoader';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import type React from 'react';
import { useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { FollowButton } from './FollowButton';
import { CustomBackIconSvg, CustomMenuIconSvg, EmptyIconSvg, PlusIconSvg, ProfileIconSvg, SearchIconSvg } from '@assets/icons/svgStrings';
import { svgToDataUri } from '@/shared/utils/svgUtils';
import { Image } from 'expo-image';


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
  const [menuVisible, setMenuVisible] = useState(false);
  const navigation = useNavigation<any>();

  const navigationItems = [
    { name: 'Feed', icon: EmptyIconSvg, route: 'Feed' },
    { name: 'Search', icon: SearchIconSvg, route: 'Search' },
    { name: 'Profile', icon: ProfileIconSvg, route: 'Profile' },
    { name: 'New Post', icon: PlusIconSvg, route: 'NewPost' },
  ];

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
    if (onMenuPress) {
      onMenuPress();
    }
  };

  const handleNavigation = (route: string) => {
    setMenuVisible(false);
    navigation.navigate(route);
  };

  return (
    <View>
      <View className="w-full z-10 bg-[#DCDCDE] flex justify-end" style={{ height: 110 }}>
        <View className="flex-row items-center justify-between px-8 mb-4">
          {showBackButton ? (
            <TouchableOpacity
              className="w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
              onPress={onBackPress}
            >
              <Image
                source={{ uri: svgToDataUri(CustomBackIconSvg) }}
                style={[{ width: 30, height: 30 }, {}]}
              />
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10" />
          )}
          <Text className="text-5xl font-light text-center flex-1">
            {profileData?.username || 'Capture'}
          </Text>

          {showMenuButton ? (
            isOwnProfile ? (
              <NotificationButton />
            ) : (
              <TouchableOpacity
                className="w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
                onPress={toggleMenu}
              >
                <Image
                  source={{ uri: svgToDataUri(CustomMenuIconSvg) }}
                  style={[{ width: 30, height: 30 }, {}]}
                />
              </TouchableOpacity>
            )
          ) : (
            <View className="w-10 h-10" />
          )}
        </View>
      </View>

      {menuVisible && (
        <Modal
          transparent={true}
          visible={menuVisible}
          animationType="none"
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setMenuVisible(false)}
          >
            <View style={{ flex: 1 }} />
          </Pressable>

          <MotiView
            from={{ translateY: -200, opacity: 0 }}
            animate={{ translateY: menuVisible ? 0 : -200, opacity: menuVisible ? 1 : 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100 }}
            className="absolute right-4 top-14 z-50 w-56 h-72"
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="w-56 h-72 pb-10 flex flex-col justify-start items-start gap-0.5">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.route}
                      className="self-stretch h-14 relative bg-[#e4cac7] rounded-2xl shadow-sm"
                      onPress={() => handleNavigation(item.route)}
                    >
                      <Text className="left-[60px] top-[16px] absolute justify-center text-neutral-900 text-base font-base leading-normal">
                        {item.name}
                      </Text>
                      <View className="w-10 h-10 left-[8px] top-[8px] absolute bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex justify-center items-center">
                        <Image
                          source={{ uri: svgToDataUri(Icon) }}
                          style={{ width: 22, height: 22 }}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </MotiView>
        </Modal>
      )}

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
              <MediaImage media={profileData.profileImage} width={120} circle />
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
            <Text
              className="text-black text-sm font-light font-['Roboto'] leading-snug mt-1"
              numberOfLines={2}
              ellipsizeMode="tail"
            >
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
                  <TouchableOpacity className="bg-stone-300 rounded-[30px] border border-stone-300 h-6 w-16 flex items-center justify-center">
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
