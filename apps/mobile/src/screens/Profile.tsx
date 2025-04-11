import React, { useState, useCallback } from 'react';
import { View, Modal, StatusBar, useWindowDimensions, Text } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../components/Navigators/types/navigation';
import { useUserPosts, useDeletePost } from '../hooks/usePosts';
import { useProfile } from '../hooks/auth/useProfile';
import { useFollowers, useSyncFollowingState } from '../hooks/useRelationships';
import { useSavedPosts, useSavePost, useUnsavePost } from '../hooks/useSavesPosts';
import { FollowList } from '../components/profile/FollowList';
import { PostMenu } from '../components/post/PostMenu';
import { useBlockUser } from '../hooks/useBlocking';
import Header from '../components/ui/Header';
import { useAlert } from '../lib/AlertContext';
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '../atoms/commentAtoms';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileTabView } from '../components/profile/ProfileTabView';
import { PostCarousel } from '../components/profile/PostCarousel';
import { NewPostButton } from '../components/profile/NewPostButton';
import LockIcon2 from '../../assets/icons/LockIcon2.svg';
import { SkeletonElement } from '../components/ui/SkeletonLoader';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type ProfileRouteProp = RouteProp<AppStackParamList, 'Profile'>;

export default function Profile() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProfileRouteProp>();
  const { user } = useAuthStore();
  const { showAlert } = useAlert();
  const userId = route.params?.userId || user?.id;
  const isOwnProfile = userId === user?.id;
  
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

  useSyncFollowingState(profileData ? [{ 
    userId: profileData.userId,
    isFollowing: profileData.isFollowing 
  }] : []);

  const getGridItemSize = useCallback(() => {
    const contentWidth = width * 0.92; 
    const spacing = 6; 
    const itemSize = (contentWidth - (spacing * 2)) / 3;
    
    return {
      itemSize,
      horizontalMargin: spacing
    };
  }, [width]);

  const { itemSize, horizontalMargin } = getGridItemSize();
  
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
      <View className="flex-1 bg-zinc-300">
        <StatusBar barStyle="dark-content" />
        <Header 
          showBackButton={true} 
          onBackPress={() => navigation.goBack()} 
        />
        <View className="px-6 pt-4">
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
          
          <View className="w-full h-16 bg-zinc-300 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
            <View className="flex-row justify-center items-center h-full">
              {[0, 1, 2].map((_, index) => (
                <View key={index} className="items-center mx-10">
                  <SkeletonElement width={28} height={28} radius={10} />
                </View>
              ))}
            </View>
          </View>
          
          <View className="flex-row flex-wrap mt-4">
            {Array(9).fill(0).map((_, index) => (
              <View key={index} style={{ 
                width: itemSize, 
                height: itemSize, 
                marginRight: index % 3 !== 2 ? horizontalMargin : 0,
                marginBottom: horizontalMargin 
              }}>
                <SkeletonElement 
                  width="100%" 
                  height="100%" 
                  radius={10} 
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (isProfilePrivate) {
    return (
      <View className="flex-1 bg-zinc-300">
        <StatusBar barStyle="dark-content" />
        <Header 
          showBackButton={true} 
          onBackPress={() => navigation.goBack()} 
        />
        <View className="px-6 pt-4">
          <ProfileHeader 
            profileData={profileData}
            isOwnProfile={isOwnProfile}
            userId={userId || ''}
            onFollowersPress={() => setShowFollowers(true)}
          />
          <View className="mt-8 items-center">
            <View className="bg-stone-200 rounded-lg p-6 w-full items-center">
              <LockIcon2 height={50} width={50} />
              <Text className="text-lg font-semibold mt-4">This Account is Private</Text>
              <Text className="text-sm text-center mt-2 opacity-70">
                Follow this account to see their photos and videos.
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-300">
      <StatusBar barStyle="dark-content" />
      
      <Header 
        showBackButton={true} 
        onBackPress={() => navigation.goBack()} 
      />
      
      <View className="flex-1">
        <View className="px-6 pt-4">
          <ProfileHeader 
            profileData={profileData}
            isOwnProfile={isOwnProfile}
            userId={userId || ''}
            onFollowersPress={() => setShowFollowers(true)}
            onSettingsPress={() => navigation.navigate('Settings', { screen: 'MainSettings' })}
            isLoading={profileLoading}
          />
        </View>
        
        <View className="flex-1">
          <ProfileTabView
            posts={posts || []}
            savedPosts={savedPosts || []}
            itemSize={itemSize}
            spacing={horizontalMargin}
            onPostPress={openCarouselAtPhoto}
            isLoading={postsLoading}
            isLoadingSaved={savedPostsLoading}
            onTabPress={(index) => {
              setShowPostCarousel(false);
            }}
            carouselActive={showPostCarousel}
          />
        </View>
        
        {carouselPosts.length > 0 && showPostCarousel && (
          <View className="absolute top-0 left-0 right-0 bottom-0 bg-zinc-300" style={{ marginTop: 180 }}>
            <View className="flex-1 px-6">
              <PostCarousel 
                posts={carouselPosts}
                initialIndex={initialPostIndex}
                onSettingsPress={handlePostSettings}
                onToggleSave={handleToggleSavePost}
                onOpenComments={handleOpenComments}
                isSaving={savePostMutation.isPending || unsavePostMutation.isPending}
              />
            </View>
          </View>
        )}
      </View>
      
      {isOwnProfile && (
        <NewPostButton onPress={() => navigation.navigate('NewPost')} />
      )}
      
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