import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { useSessionStore } from '../stores/sessionStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { useUserPosts } from '../hooks/usePosts';
import { MediaImage } from '../components/media/MediaImage';
import { Ionicons } from '@expo/vector-icons';
import SavedPosts from "../assets/icons/Favorites Icon.svg"
import Placeholder from "../assets/icons/View Password Icon.svg"
import NewPost from "../assets/icons/Plus Icon.svg"
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ProfileImage } from '../components/media/ProfileImage';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
const POSTS_PER_PAGE = 4;
const { width, height } = Dimensions.get('window');

export default function Profile() {
  const navigation = useNavigation<NavigationProp>();
  const { authUser, userProfile } = useSessionStore();
  const { data: posts, isLoading} = useUserPosts(authUser?.id);
  const [currentPage, setCurrentPage] = useState(0);
  
  const isOwnProfile = true;
  
  const totalPages = posts ? Math.ceil(posts.length / POSTS_PER_PAGE) : 0;

  const currentPosts = posts ? 
    posts.slice(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE) : 
    [];
  
  const handlePageChange = (pageIndex: number) => {
    setCurrentPage(pageIndex);
  };

  return (
    <View className="flex-1 bg-[#DCDCDE]">
      {/* Background Image */}
      <Image
        source={require('../assets/Fluid Background Coffee.png')}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
        resizeMode="cover"
      />
      
      {/* Header */}
      <View className="flex-row items-center p-4 bg-transparent">
        <TouchableOpacity onPress={() => navigation.navigate('Feed')}>
          <Ionicons name="arrow-back" size={28} color="black" />
        </TouchableOpacity>
        <Text className="text-[36px] font-light mx-auto">Capture</Text>
        <View style={{ width: 28 }} />
      </View>
      
      <ScrollView className="flex-1">
        {/* Top section */}
        <View className="bg-white p-4">
          <View className="flex-row">
            {userProfile?.profileImage ? (
              <View className="w-32 h-32 rounded-full overflow-hidden">
                <ProfileImage cloudflareId={userProfile.profileImage} />
              </View>
            ) : (
              <View className="w-32 h-32 rounded-full bg-gray-200" />
            )}
            
            <View className="ml-4 flex-1">
              <Text className="text-xl font-bold">{userProfile?.username || 'Username'}</Text>
              <Text className="text-gray-600 mt-1">{userProfile?.bio || 'No bio yet'}</Text>
              
              {isOwnProfile && (
                <TouchableOpacity 
                  className="bg-[#E4CAC7] py-2 px-4 mt-3 self-start"
                >
                  <Text className="text-center font-semibold">Settings</Text>
                </TouchableOpacity>
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
        
        {/* Posts grid */}
        <View className="mt-2">
          {isLoading ? (
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
              
              {/* Pagination */}
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
      
      {/* New Post button */}
      <TouchableOpacity 
        className="absolute bottom-6 right-6 bg-[#E4CAC7] px-4 py-3 rounded-full flex-row items-center shadow-lg"
        onPress={() => navigation.navigate('NewPost')}
      >
         <NewPost width={24} height={24}/>
        <Text className="ml-2 font-medium text-black">New Post</Text>
      </TouchableOpacity>
    </View>
  );
}