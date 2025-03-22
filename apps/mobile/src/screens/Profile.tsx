import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StatusBar } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../components/Navigators/types/navigation';
import { useUserPosts } from '../hooks/usePosts';
import { useProfile } from '../hooks/auth/useProfile';
import { useFollowers, useFollowing } from '../hooks/useRelationships';
import { MediaImage } from '../components/media/MediaImage';
import { ThreadItem } from '../components/post/ThreadItem';
import SavedPosts from "../../assets/icons/FavoriteIcon.svg"
import PhotosIcon from "../../assets/icons/PhotosIcon.svg"
import TextIcon from "../../assets/icons/TextIcon.svg"
import NewPost from "../../assets/icons/PlusIcon.svg"
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ProfileImage } from '../components/media/ProfileImage';
import { FollowList } from '../components/profile/FollowList';
import { FollowButton } from '../components/profile/FollowButton';
import Header from '../components/ui/Header';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type ProfileRouteProp = RouteProp<AppStackParamList, 'Profile'>;
const POSTS_PER_PAGE = 9;

export default function Profile() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProfileRouteProp>();
  const { user } = useAuthStore();
  const userId = route.params?.userId || user?.id;
  const isOwnProfile = userId === user?.id;
  
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [postFilter, setPostFilter] = useState<'posts' | 'threads'>(isOwnProfile ? 'posts' : 'threads');
  const [currentPage, setCurrentPage] = useState(0);
  
  const { data: profileData, isLoading: profileLoading } = useProfile(userId);
  const { data: posts, isLoading: postsLoading } = useUserPosts(userId);
  const { data: followers, isLoading: followersLoading } = useFollowers(userId);
  const { data: following, isLoading: followingLoading } = useFollowing(userId);

  const filteredPosts = posts ? 
    posts.filter((post: { type?: string }) => 
      postFilter === 'posts' 
        ? post.type === 'post' || !post.type 
        : post.type === 'thread'
    ) : [];
  
  const totalPages = filteredPosts ? Math.ceil(filteredPosts.length / POSTS_PER_PAGE) : 0;

  const currentPosts = filteredPosts ? 
    filteredPosts.slice(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE) : 
    [];
  
  const handlePageChange = (pageIndex: number) => {
    setCurrentPage(pageIndex);
  };

  if (profileLoading) {
    return <LoadingSpinner fullScreen message="Loading profile..." />;
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
                    >
                      <Text className="text-white text-xs font-normal text-center">Settings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      className="bg-stone-300 rounded-[30px] border border-stone-300 px-4 py-1"
                      onPress={() => setShowFollowers(true)}
                    >
                      <Text className="text-black text-xs font-normal text-center">Followers</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <FollowButton 
                      userId={userId || ''}
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
          
          <View className="flex-row justify-around py-2 items-center">
            <TouchableOpacity 
              className="items-center justify-center"
              onPress={() => setPostFilter('posts')}
            >
              <View className={postFilter === 'posts' ? "bg-stone-300 bg-opacity-30 w-7 h-7 rounded-[10px] items-center justify-center" : ""}>
                <PhotosIcon width={20} height={20}/>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              className="items-center justify-center"
              onPress={() => setPostFilter('threads')}
            >
              <View className={postFilter === 'threads' ? "bg-stone-300 bg-opacity-30 w-7 h-7 rounded-[10px] items-center justify-center" : ""}>
                <TextIcon width={20} height={20} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              className="items-center justify-center"
              onPress={() => {/* Saved posts */}}
            >
              <SavedPosts width={20} height={20}/>
            </TouchableOpacity>
          </View>
          
          <View className="h-px bg-black opacity-10 my-2" />
          
          {postsLoading ? (
            <LoadingSpinner />
          ) : filteredPosts?.length === 0 ? (
            <Text className="text-center py-4 text-gray-500">No {postFilter} yet</Text>
          ) : (
            <>
              {/* Posts Grid (3x3) or Threads List */}
              {postFilter === 'posts' ? (
                <View className="flex-row flex-wrap mt-4">
                  {currentPosts.map((post: any) => (
                    <TouchableOpacity 
                      key={post.id} 
                      className="w-[32%] aspect-square mb-[2%] mr-[2%] nth-child-3n:mr-0"
                      onPress={() => navigation.navigate('SinglePost', { post })}
                    >
                      <View className="w-full h-full bg-stone-400 rounded-[10px] overflow-hidden">
                        {post.media && post.media.length > 0 ? (
                          <MediaImage media={post.media[0]} />
                        ) : (
                          <View className="flex-1 justify-center items-center">
                            <Text className="text-white opacity-70">No image</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View className="mt-4">
                  {currentPosts.map((thread: any) => (
                    <ThreadItem key={thread.id} thread={thread} />
                  ))}
                </View>
              )}
              
              {totalPages > 1 && (
                <View className="flex-row justify-center py-4">
                  <View className="bg-blend-color-dodge bg-stone-950 rounded-[50px] backdrop-blur-[20px] p-2 flex-row">
                    {Array(totalPages).fill(0).map((_, index) => (
                      <TouchableOpacity 
                        key={index}
                        onPress={() => handlePageChange(index)}
                      >
                        <View 
                          className={`h-2 w-2 rounded-full mx-1 ${
                            index === currentPage ? 'bg-black' : 'bg-black opacity-30'
                          }`} 
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      
      {isOwnProfile && (
        <TouchableOpacity 
          className="absolute bottom-6 right-6 shadow-lg"
          onPress={() => navigation.navigate('NewPost')}
        >
          <View className="bg-stone-300 rounded-[10px] border border-black flex-row items-center px-2 py-1">
            <NewPost width={20} height={20}/>
            <Text className="ml-2 text-xs font-normal">New Post</Text>
          </View>
        </TouchableOpacity>
      )}
      
      <Modal
        visible={showFollowers}
        animationType="slide"
        onRequestClose={() => setShowFollowers(false)}
      >
        <FollowList
          data={followers || []}
          loading={followersLoading}
          title="Followers"
          onClose={() => setShowFollowers(false)}
          currentUserId={user?.id}
        />
      </Modal>

      <Modal
        visible={showFollowing}
        animationType="slide"
        onRequestClose={() => setShowFollowing(false)}
      >
        <FollowList
          data={following || []}
          loading={followingLoading}
          title="Following"
          onClose={() => setShowFollowing(false)}
          currentUserId={user?.id}
        />
      </Modal>
    </View>
  );
}