import { useAuthStore } from '@/features/auth/stores/authStore';
import { commentDrawerOpenAtom, currentPostIdAtom } from '@/features/comments/atoms/commentAtoms';
import { PostMenu } from '@/features/post/components/PostMenu';
import { useDeletePost, useUserPosts } from '@/features/post/hooks/usePosts';
import { useSavePost, useSavedPosts, useUnsavePost } from '@/features/post/hooks/useSavesPosts';
import { useBlockUser } from '@/features/profile/hooks/useBlocking';
import { useGridCarouselLayout } from '@/features/profile/hooks/useGridCarouselLayout';
import type { AppStackParamList } from '@/navigation/types';
import { SkeletonElement } from '@/shared/components/SkeletonLoader';
import { useAlert } from '@/shared/lib/AlertContext';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAtom } from 'jotai';
import React, { useState, useCallback } from 'react';
import { Modal, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { FollowList } from '../components/FollowList';
import { NewPostButton } from '../components/NewPostButton';
import { PostCarousel } from '../components/PostCarousel';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileTabView } from '../components/ProfileTabView';
import { useProfile } from '../hooks/useProfile';
import { useFollowers } from '../hooks/useRelationships';
import { LockIcon2Svg } from '@assets/icons/svgStrings';
import { svgToDataUri } from '@/shared/utils/svgUtils';
import { Image } from 'expo-image';


type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type ProfileRouteProp = RouteProp<AppStackParamList, 'Profile'>;

export default function Profile() {
  const { height, width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProfileRouteProp>();
  const { user } = useAuthStore();
  const { showAlert } = useAlert();
  const userId = route.params?.userId || user?.id;
  const isOwnProfile = userId === user?.id;

  // Use the new grid-carousel layout hook
  const gridCarouselLayout = useGridCarouselLayout();

  const [showFollowers, setShowFollowers] = useState(false);
  const [showPostCarousel, setShowPostCarousel] = useState(false);
  const [initialPostIndex, setInitialPostIndex] = useState(0);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const blockUserMutation = useBlockUser(selectedPost?.user?.userId || '');
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);

  const { data: profileData, isLoading: profileLoading } = useProfile(userId);
  const isProfilePrivate = profileData?.isPrivate && !profileData?.isFollowing && !isOwnProfile;
  const { data: posts, isLoading: postsLoading } = useUserPosts(userId);
  const { data: followers, isLoading: followersLoading } = useFollowers(userId);
  const { data: savedPosts, isLoading: savedPostsLoading } = useSavedPosts(30, 0);
  const deletePostMutation = useDeletePost();
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();

  // Extract layout values from the hook
  const { itemSize, spacing, containerPadding, carouselTop, carouselHeight } = gridCarouselLayout;

  const carouselPosts = React.useMemo(() => {
    return posts ? posts.filter((post: any) => post.type === 'post') : [];
  }, [posts]);

  const openCarouselAtPhoto = (post: any) => {
    const postIndex = carouselPosts.findIndex((p: any) => p.id === post.id);
    if (postIndex >= 0) {
      setInitialPostIndex(postIndex);
      setShowPostCarousel(true);
    }
  };

  const handlePostSettings = (post: any) => {
    setSelectedPost(post);
    setMenuVisible(true);
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;

    try {
      await deletePostMutation.mutateAsync(selectedPost.id);
      setMenuVisible(false);
      setShowPostCarousel(false);
    } catch (error: any) {
      console.error('Delete error:', error);
    }
  };

  const handleToggleSavePost = async (post: any) => {
    try {
      if (post.isSaved) {
        await unsavePostMutation.mutateAsync(post.id);
      } else {
        await savePostMutation.mutateAsync(post.id);
      }
    } catch (error: any) {
      console.error('Save/Unsave error:', error);
      showAlert(`Failed to ${post.isSaved ? 'unsave' : 'save'} post`, { type: 'error' });
    }
  };

  const handleOpenComments = (postId: string) => {
    setCurrentPostId(postId);
    setCommentDrawerOpen(true);
  };

  const handleBlockUser = async () => {
    if (!selectedPost?.user?.userId) return;

    try {
      await blockUserMutation.mutateAsync();
      setMenuVisible(false);
      showAlert('User blocked successfully', { type: 'success' });
      if (!isOwnProfile) {
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Block user error:', error);
      showAlert('Failed to block user', { type: 'error' });
    }
  };

  if (profileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#dcdcde' }}>
        <View onLayout={(event) => gridCarouselLayout.updateHeaderHeight(event.nativeEvent.layout.height)}>
          <ProfileHeader
            isLoading
            showBackButton
            onBackPress={() => navigation.goBack()}
            showMenuButton
            onMenuPress={() => {}}
          />
        </View>
        <StatusBar barStyle="dark-content" />
        <View style={{ backgroundColor: '#DCDCDE' }}>
          {/* Skeleton Tab Bar */}
          <View
            className="w-full h-12"
            style={{
              backgroundColor: '#DCDCDE',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 8,
              zIndex: 10,
              position: 'relative',
              marginBottom: spacing,
            }}
          >
            <View className="flex-row justify-between items-end h-full px-4 pb-2">
              {[0, 1, 2].map((_, idx) => (
                <View key={idx} className="flex-1 items-center">
                  <SkeletonElement width={20} height={20} radius={4} />
                </View>
              ))}
            </View>
          </View>

          {/* Skeleton Posts Grid */}
          <View
            style={{
              paddingHorizontal: containerPadding,
              paddingTop: spacing,
            }}
          >
            {/* Create 3 rows of 3 items each */}
            {[0, 1, 2].map((row) => (
              <View 
                key={row} 
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: spacing,
                }}
              >
                {[0, 1, 2].map((col) => (
                  <View
                    key={`${row}-${col}`}
                    style={{
                      width: itemSize,
                      height: itemSize,
                    }}
                  >
                    <SkeletonElement width="100%" height="100%" radius={10} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (isProfilePrivate) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1 }}>
          <View className="flex-1 bg-[#DCDCDE]">
            <StatusBar barStyle="dark-content" />
            <View className="px-6 pt-4">
              <View onLayout={(event) => gridCarouselLayout.updateHeaderHeight(event.nativeEvent.layout.height)}>
                <ProfileHeader
                  profileData={profileData}
                  isOwnProfile={isOwnProfile}
                  userId={userId || ''}
                  onFollowersPress={() => setShowFollowers(true)}
                  onSettingsPress={() => navigation.navigate('Settings', { screen: 'MainSettings' })}
                  showBackButton={true}
                  onBackPress={() => navigation.goBack()}
                  showMenuButton={true}
                  onMenuPress={() => {
                    /* menu logic here */
                  }}
                />
              </View>
              <View className="mt-8 items-center">
                <View className="bg-stone-200 rounded-lg p-6 w-full items-center">
                  <Image
        source={{ uri: svgToDataUri(LockIcon2Svg) }}
        style={[{ width: 50, height: 50 }, {}]}
      />
                  <Text className="text-lg font-semibold mt-4">This Account is Private</Text>
                  <Text className="text-sm text-center mt-2 opacity-70">
                    Follow this account to see their photos and videos.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View className="flex-1 bg-[#DCDCDE]">
        <View onLayout={(event) => gridCarouselLayout.updateHeaderHeight(event.nativeEvent.layout.height)}>
          <ProfileHeader
            profileData={profileData}
            isOwnProfile={isOwnProfile}
            userId={userId || ''}
            onFollowersPress={() => setShowFollowers(true)}
            onSettingsPress={() => navigation.navigate('Settings', { screen: 'MainSettings' })}
            showBackButton={true}
            onBackPress={() => navigation.goBack()}
            showMenuButton={true}
          />
        </View>
        <StatusBar barStyle="dark-content" />
        <View className="flex-1">
          <ProfileTabView
            posts={posts || []}
            savedPosts={savedPosts || []}
            itemSize={itemSize}
            spacing={spacing}
            containerPadding={containerPadding}
            onPostPress={openCarouselAtPhoto}
            isLoading={postsLoading}
            isLoadingSaved={savedPostsLoading}
            onTabPress={() => {
              setShowPostCarousel(false);
            }}
            carouselActive={showPostCarousel}
            onTabBarLayout={gridCarouselLayout.onTabBarLayout}
          />
        </View>
      </View>

      {carouselPosts.length > 0 && showPostCarousel && (
        <View
          className="absolute left-0 right-0 bg-[#DCDCDE]"
          style={{
            top: carouselTop,
            height: carouselHeight,
            zIndex: 1,
          }}
        >
          <View className="flex-1 px-4">
            <PostCarousel
              posts={carouselPosts}
              initialIndex={initialPostIndex}
              carouselHeight={carouselHeight}
              itemSize={itemSize}
            />
          </View>
        </View>
      )}

      {isOwnProfile && <NewPostButton onPress={() => navigation.navigate('NewPost')} />}

      <Modal
        visible={showFollowers}
        animationType="slide"
        onRequestClose={() => setShowFollowers(false)}
      >
        <FollowList
          data={followers || []}
          loading={followersLoading}
          onClose={() => setShowFollowers(false)}
          currentUserId={user?.id}
        />
      </Modal>

      <PostMenu
        isVisible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onDeletePost={isOwnProfile ? handleDeletePost : undefined}
        onBlockUser={!isOwnProfile ? handleBlockUser : undefined}
        onReportPost={() => {
          showAlert('Implement Post Reporting here', { type: 'success' });
          setMenuVisible(false);
        }}
        onWhySeeing={() => {
          showAlert('Implement Why Seeing here', { type: 'info' });
          setMenuVisible(false);
        }}
        onEnableNotifications={() => {
          showAlert('Implement Notification Settings here', { type: 'success' });
          setMenuVisible(false);
        }}
        isOwnPost={selectedPost?.user?.userId === user?.id}
        isLoading={
          selectedPost?.user?.userId === user?.id
            ? deletePostMutation.isPending
            : blockUserMutation.isPending
        }
      />
    </View>
  );
}
