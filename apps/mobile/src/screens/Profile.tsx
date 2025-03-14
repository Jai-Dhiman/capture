import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, Dimensions } from 'react-native';
import { useSessionStore } from '../stores/sessionStore';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { useUserPosts } from '../hooks/usePosts';
import { useProfile } from '../hooks/auth/useProfile';
import { useFollowers, useFollowing } from '../hooks/useRelationships';
import { MediaImage } from '../components/media/MediaImage';
import { Ionicons } from '@expo/vector-icons';
import SavedPosts from "../../assets/icons/FavoriteIcon.svg"
import Placeholder from "../../assets/icons/ViewPasswordIcon.svg"
import NewPost from "../../assets/icons/PlusIcon.svg"
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ProfileImage } from '../components/media/ProfileImage';
import { FollowButton } from '../components/profile/FollowButton';
import { FollowList } from '../components/profile/FollowList';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type ProfileRouteProp = RouteProp<AppStackParamList, 'Profile'>;
const POSTS_PER_PAGE = 4;

export default function Profile() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProfileRouteProp>();
  const { authUser } = useSessionStore();
  
  const userId = route.params?.userId || authUser?.id;
  const isOwnProfile = userId === authUser?.id;
  
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  
  const { data: profileData, isLoading: profileLoading } = useProfile(userId);
  const { data: posts, isLoading: postsLoading } = useUserPosts(userId);
  const { data: followers, isLoading: followersLoading } = useFollowers(userId);
  const { data: following, isLoading: followingLoading } = useFollowing(userId);
  
  const totalPages = posts ? Math.ceil(posts.length / POSTS_PER_PAGE) : 0;

  const currentPosts = posts ? 
    posts.slice(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE) : 
    [];
  
  const handlePageChange = (pageIndex: number) => {
    setCurrentPage(pageIndex);
  };

  if (profileLoading) {
    return <LoadingSpinner fullScreen message="Loading profile..." />;
  }

  return (
    <View className="flex-1 bg-[#DCDCDE]">
      <Image
        source={require('../../assets/DefaultBackground.png')}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
        resizeMode="cover"
      />
      
      <View className="flex-row items-center p-4 bg-transparent">
        <TouchableOpacity onPress={() => navigation.navigate('Feed')}>
          <Ionicons name="arrow-back" size={28} color="black" />
        </TouchableOpacity>
        <Text className="text-[36px] font-light mx-auto">Capture</Text>
        <View style={{ width: 28 }} />
      </View>
      
      <ScrollView className="flex-1">
        <View className="bg-white p-4">
          <View className="flex-row">
            {profileData?.profileImage ? (
              <View className="w-32 h-32 rounded-full overflow-hidden">
                <ProfileImage cloudflareId={profileData.profileImage} />
              </View>
            ) : (
              <View className="w-32 h-32 rounded-full bg-gray-200" />
            )}
            
            <View className="ml-4 flex-1">
              <Text className="text-xl font-bold">{profileData?.username || 'Username'}</Text>
              <Text className="text-gray-600 mt-1">{profileData?.bio || 'No bio yet'}</Text>
              
              <View className="flex-row mt-2">
                <TouchableOpacity onPress={() => setShowFollowers(true)}>
                  <Text className="mr-4">
                    <Text className="font-bold">{profileData?.followersCount || 0}</Text> followers
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowFollowing(true)}>
                  <Text>
                    <Text className="font-bold">{profileData?.followingCount || 0}</Text> following
                  </Text>
                </TouchableOpacity>
              </View>
              
              {isOwnProfile ? (
                <TouchableOpacity 
                  className="bg-[#E4CAC7] py-2 px-4 mt-3 self-start"
                >
                  <Text className="text-center font-semibold">Settings</Text>
                </TouchableOpacity>
              ) : (
                <FollowButton 
                  userId={userId!} 
                  isFollowing={profileData?.isFollowing} 
                  className="mt-3 self-start"
                />
              )}
            </View>
          </View>
        </View>
        
        <View className="bg-white">
          <View className="flex-row justify-around py-4">
            <TouchableOpacity>
              <Ionicons name="grid-outline" size={24} color="black" />
            </TouchableOpacity>
            <TouchableOpacity>
              <Placeholder width={24} height={24}/>
            </TouchableOpacity>
            <TouchableOpacity>
              <SavedPosts width={24} height={24}/>
            </TouchableOpacity>
          </View>
          
          <View className="h-[1px] bg-gray-300 w-full" />
        </View>
        
        <View className="mt-2">
          {postsLoading ? (
            <LoadingSpinner />
          ): posts?.length === 0 ? (
            <Text className="text-center py-4 text-gray-500">No posts yet</Text>
          ) : (
            <>
              <View className="flex-row flex-wrap">
                {currentPosts.map((post: any, index: number) => (
                  <TouchableOpacity 
                    key={post.id} 
                    className="w-1/2 aspect-square p-1"
                    onPress={() => navigation.navigate('SinglePost', { post })}
                  >
                    <View className="w-full h-full">
                      {post.media && post.media.length > 0 ? (
                        <MediaImage media={post.media[0]} />
                      ) : (
                        <View className="flex-1 justify-center items-center">
                          <Text className="text-gray-400">No image</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                
                {currentPosts.length < POSTS_PER_PAGE && 
                  Array(POSTS_PER_PAGE - currentPosts.length).fill(0).map((_, index) => (
                    <View key={`empty-${index}`} className="w-1/2 aspect-square p-1">
                      <View className="bg-transparent w-full h-full" />
                    </View>
                  ))
                }
              </View>
              
              {totalPages > 1 && (
                <View className="flex-row justify-center py-4">
                  <View className="bg-[#E4CAC7] px-4 py-2 rounded-full flex-row">
                    {Array(totalPages).fill(0).map((_, index) => (
                      <TouchableOpacity 
                        key={index}
                        onPress={() => handlePageChange(index)}
                        className="mx-1"
                      >
                        <View 
                          className={`h-2 w-2 rounded-full ${
                            index === currentPage ? 'bg-black' : 'bg-gray-600'
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
          className="absolute bottom-6 right-6 bg-[#E4CAC7] px-4 py-3 rounded-full flex-row items-center shadow-lg"
          onPress={() => navigation.navigate('NewPost')}
        >
          <NewPost width={24} height={24}/>
          <Text className="ml-2 font-medium text-black">New Post</Text>
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
          currentUserId={authUser?.id}
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
          currentUserId={authUser?.id}
        />
      </Modal>
    </View>
  );
}