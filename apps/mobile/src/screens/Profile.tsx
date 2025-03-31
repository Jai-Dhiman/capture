import React, { useState, useCallback } from 'react';
import { View, ScrollView, Modal, StatusBar, useWindowDimensions, Text } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../components/Navigators/types/navigation';
import { useUserPosts, useDeletePost } from '../hooks/usePosts';
import { useProfile } from '../hooks/auth/useProfile';
import { useFollowers, useSyncFollowingState } from '../hooks/useRelationships';
import { useSavePost, useUnsavePost } from '../hooks/useSavesPosts';
import { ProfileThreadItem } from '../components/profile/ProfileThreadItem';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { FollowList } from '../components/profile/FollowList';
import Header from '../components/ui/Header';
import { PostSettingsMenu } from '../components/post/PostSettingsMenu';
import { useAlert } from '../lib/AlertContext';
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '../atoms/commentAtoms';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { FilterTabs } from '../components/profile/FilterTabs';
import { PostsGrid } from '../components/profile/PostsGrid';
import { PostCarousel } from '../components/profile/PostCarousel';
import { NewPostButton } from '../components/profile/NewPostButton';
import LockIcon2 from '../../assets/icons/LockIcon2.svg';

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
  const [postFilter, setPostFilter] = useState<'posts' | 'threads'>(isOwnProfile ? 'posts' : 'threads');
  const [showPostCarousel, setShowPostCarousel] = useState(false);
  const [initialPostIndex, setInitialPostIndex] = useState(0);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  
  
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  const { data: profileData, isLoading: profileLoading } = useProfile(userId);
  const isProfilePrivate = profileData?.isPrivate && !profileData?.isFollowing && !isOwnProfile;
  const { data: posts, isLoading: postsLoading } = useUserPosts(userId);
  const { data: followers, isLoading: followersLoading } = useFollowers(userId);
  const deletePostMutation = useDeletePost();
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();

  useSyncFollowingState(profileData ? [{ 
    userId: profileData.userId,
    isFollowing: profileData.isFollowing 
  }] : []);

  const filteredPosts = posts ? 
    posts.filter((post: any) => {
      if (postFilter === 'posts') {
        return post.type === 'post';
      } else {
        return post.type === 'thread';
      }
    }) : [];
  
  const carouselPosts = filteredPosts ? filteredPosts.filter((post: any) => post.type === 'post') : [];
  
  const getGridItemSize = useCallback(() => {
    const contentWidth = width - 32;
    const itemSize = (contentWidth - 16) / 3;
    return {
      itemSize,
      horizontalMargin: 8
    };
  }, [width]);

  const { itemSize, horizontalMargin } = getGridItemSize();
  
  const handleFilterChange = (filter: 'posts' | 'threads') => {
    setPostFilter(filter);
    setShowPostCarousel(false);
  };
  
  const openCarouselAtPhoto = (post: any) => {
    const postIndex = carouselPosts.findIndex((p: any) => p.id === post.id);
    if (postIndex >= 0) {
      setInitialPostIndex(postIndex);
      setShowPostCarousel(true);
    }
  };
  
  const handlePostSettings = (post: any) => {
    setSelectedPost(post);
    setIsMenuVisible(true);
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;
    
    try {
      await deletePostMutation.mutateAsync(selectedPost.id);
      setIsMenuVisible(false);
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

  if (profileLoading) {
    return <LoadingSpinner fullScreen message="Loading profile..." />;
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
      
      <ScrollView className="flex-1">
        <View className="px-6 pt-4">
          <ProfileHeader 
            profileData={profileData}
            isOwnProfile={isOwnProfile}
            userId={userId || ''}
            onFollowersPress={() => setShowFollowers(true)}
            onSettingsPress={() => navigation.navigate('MainSettings')}
          />
          
          <FilterTabs 
            postFilter={postFilter}
            onFilterChange={handleFilterChange}
          />
          
          <View className="h-px bg-black opacity-10 my-2" />               
          
          {postsLoading ? (
            <LoadingSpinner />
          ) : filteredPosts?.length === 0 ? (
            <Text className="text-center py-4 text-gray-500">No {postFilter} yet</Text>
          ) : (
            <>
              {showPostCarousel && postFilter === 'posts' ? (
                <View className="mt-2 pb-2">
                <PostCarousel 
                  posts={carouselPosts}
                  initialIndex={initialPostIndex}
                  onSettingsPress={handlePostSettings}
                  onToggleSave={handleToggleSavePost}
                  onOpenComments={handleOpenComments}
                  isSaving={savePostMutation.isPending || unsavePostMutation.isPending}
                />
              </View>
              ) : (
                <>
                  {postFilter === 'posts' ? (
                    <PostsGrid 
                      posts={filteredPosts.filter((post: { type: string }) => post.type === 'post')}
                      itemSize={itemSize}
                      spacing={horizontalMargin}
                      onPostPress={openCarouselAtPhoto}
                    />
                  ) : (
                    <View className="mt-4">
                      {filteredPosts.map((thread: any) => (
                        <ProfileThreadItem key={thread.id} thread={thread} />
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
      
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
      
      <PostSettingsMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onDelete={handleDeletePost}
        isDeleting={deletePostMutation.isPending}
      />
    </View>
  );
}