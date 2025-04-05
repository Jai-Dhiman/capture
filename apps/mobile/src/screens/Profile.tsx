import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, Modal, StatusBar, useWindowDimensions, Text } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../components/Navigators/types/navigation';
import { useUserPosts, useDeletePost } from '../hooks/usePosts';
import { useProfile } from '../hooks/auth/useProfile';
import { useFollowers, useSyncFollowingState } from '../hooks/useRelationships';
import { useSavedPosts, useSavePost, useUnsavePost } from '../hooks/useSavesPosts';
import { ProfileThreadItem } from '../components/profile/ProfileThreadItem';
import { FollowList } from '../components/profile/FollowList';
import { PostMenu } from '../components/post/PostMenu';
import { useBlockUser } from '../hooks/useBlocking';
import Header from '../components/ui/Header';
import { useAlert } from '../lib/AlertContext';
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '../atoms/commentAtoms';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { FilterTabs } from '../components/profile/FilterTabs';
import { PostsGrid } from '../components/profile/PostsGrid';
import { PostCarousel } from '../components/profile/PostCarousel';
import { NewPostButton } from '../components/profile/NewPostButton';
import { PostItem } from '../components/post/PostItem';
import { ThreadItem } from '../components/post/ThreadItem';
import LockIcon2 from '../../assets/icons/LockIcon2.svg';
import { SkeletonLoader, SkeletonElement } from '../components/ui/SkeletonLoader';

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
  const [postFilter, setPostFilter] = useState<'posts' | 'threads' | 'saved'>(
    route.params?.filter === 'saved' ? 'saved' : isOwnProfile ? 'posts' : 'threads'
  );
  const [showPostCarousel, setShowPostCarousel] = useState(false);
  const [initialPostIndex, setInitialPostIndex] = useState(0);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
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
  const [menuVisible, setMenuVisible] = useState(false);

  useSyncFollowingState(profileData ? [{ 
    userId: profileData.userId,
    isFollowing: profileData.isFollowing 
  }] : []);

  const filteredPosts = React.useMemo(() => {
    if (postFilter === 'saved') {
      return savedPosts || [];
    }
    return posts ? 
      posts.filter((post: any) => {
        if (postFilter === 'posts') {
          return post.type === 'post';
        } else {
          return post.type === 'thread';
        }
      }) : [];
  }, [posts, postFilter, savedPosts]);
  
  const carouselPosts = React.useMemo(() => {
    return filteredPosts ? filteredPosts.filter((post: any) => post.type === 'post') : [];
  }, [filteredPosts]);
  
  const getGridItemSize = useCallback(() => {
    const contentWidth = width - 32;
    const itemSize = (contentWidth - 16) / 3;
    return {
      itemSize,
      horizontalMargin: 8
    };
  }, [width]);

  const { itemSize, horizontalMargin } = getGridItemSize();
  
  const handleFilterChange = (filter: 'posts' | 'threads' | 'saved') => {
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

  useEffect(() => {
    if (route.params?.filter === 'saved') {
      setPostFilter('saved');
    }
  }, [route.params?.filter]);

  if (profileLoading) {
    return (
      <View className="flex-1 bg-zinc-300">
        <StatusBar barStyle="dark-content" />
        <Header 
          showBackButton={true} 
          onBackPress={() => navigation.goBack()} 
        />
        <ScrollView className="flex-1">
          <View className="px-6 pt-4">
            {/* Profile Header Skeleton */}
            <View className="flex-row mb-4">
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
            
            {/* Filter Tabs Skeleton */}
            <View className="flex-row justify-around py-2 items-center">
              {[0, 1, 2].map((_, index) => (
                <View key={index} className="items-center">
                  <SkeletonElement width={28} height={28} radius={10} />
                </View>
              ))}
            </View>
            
            <View className="h-px bg-black opacity-10 my-2" />
            
            {/* Posts Grid Skeleton */}
            <View className="flex-row flex-wrap">
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
        </ScrollView>
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
      
      <ScrollView className="flex-1">
        <View className="px-6 pt-4">
          <ProfileHeader 
            profileData={profileData}
            isOwnProfile={isOwnProfile}
            userId={userId || ''}
            onFollowersPress={() => setShowFollowers(true)}
            onSettingsPress={() => navigation.navigate('Settings', { screen: 'MainSettings' })}
            isLoading={profileLoading}
          />
          
          <FilterTabs 
            postFilter={postFilter}
            onFilterChange={handleFilterChange}
          />
          
          <View className="h-px bg-black opacity-10 my-2" />               
          
          {postsLoading || (postFilter === 'saved' && savedPostsLoading) ? (
          <View>
            {postFilter === 'posts' || postFilter === 'saved' ? (
              <PostsGrid 
                posts={[]}
                itemSize={itemSize}
                spacing={horizontalMargin}
                onPostPress={() => {}}
                isLoading={true}
              />
            ) : (
              <View>
                {Array(3).fill(0).map((_, index) => (
                  <View key={index} className="mb-4">
                    <SkeletonElement 
                      width="100%" 
                      height={160} 
                      radius={8} 
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
          ) : filteredPosts?.length === 0 ? (
            <Text className="text-center py-4 text-gray-500">No {postFilter} yet</Text>
          ) : (
            <>
              {showPostCarousel && carouselPosts.length > 0 ? (
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
                    <View className="flex-1">
                      <PostsGrid 
                        posts={filteredPosts.filter((post: { type: string }) => post.type === 'post')}
                        itemSize={itemSize}
                        spacing={horizontalMargin}
                        onPostPress={openCarouselAtPhoto}
                      />
                    </View>
                  ) : postFilter === 'threads' ? (
                    <View className="mt-4">
                      {filteredPosts.map((thread: any) => (
                        <ProfileThreadItem key={thread.id} thread={thread} />
                      ))}
                    </View>
                  ) : (
                    <View className="mt-4">
                      {filteredPosts.filter((post: any) => post.type === 'post').length > 0 && (
                        <View className="mb-6">
                          <Text className="text-base font-medium mb-2">Saved Photos</Text>
                          <PostsGrid 
                            posts={filteredPosts.filter((post: any) => post.type === 'post')}
                            itemSize={itemSize}
                            spacing={horizontalMargin}
                            onPostPress={openCarouselAtPhoto}
                          />
                        </View>
                      )}
                      
                      {filteredPosts.filter((post: any) => post.type === 'thread').length > 0 && (
                        <View>
                          <Text className="text-base font-medium mb-2">Saved Threads</Text>
                          {filteredPosts
                            .filter((post: any) => post.type === 'thread')
                            .map((thread: any) => (
                              <ThreadItem key={thread.id} thread={thread} />
                            ))}
                        </View>
                      )}
                      
                      {filteredPosts.length === 0 && (
                        <View className="items-center py-8">
                          <Text className="text-base text-gray-500">No saved posts yet</Text>
                        </View>
                      )}
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