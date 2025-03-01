import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useSessionStore } from '../stores/sessionStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { useUserPosts } from '../hooks/usePosts';
import { MediaImage } from '../components/media/MediaImage';
import { Ionicons } from '@expo/vector-icons';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ProfileImage } from '../components/media/ProfileImage';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
const POSTS_PER_PAGE = 4;

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
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-[30px] font-light mx-auto">Capture</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView className="flex-1">
        <View className="p-4 bg-white/70 rounded-3xl mx-2 shadow-md">
          <View className="flex-row items-center">
            {userProfile?.profileImage ? (
              <View className="w-20 h-20 rounded-full overflow-hidden">
                <ProfileImage cloudflareId={userProfile.profileImage} />
              </View>
            ) : (
              <View className="w-20 h-20 rounded-full bg-gray-200" />
            )}
            <View className="ml-4 flex-1">
              <Text className="text-xl font-bold">{userProfile?.username || 'Username'}</Text>
              <Text className="text-gray-600 mt-1">{userProfile?.bio || 'No bio yet'}</Text>
            </View>
          </View>
          
          <View className="flex-row mt-4">
            {isOwnProfile ? (
              <TouchableOpacity 
                className="bg-[#E4CAC7] rounded-[30px] py-2 px-4 flex-1 shadow-md"
              >
                <Text className="text-center font-semibold">Settings</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity className="bg-[#E4CAC7] rounded-[30px] py-2 px-4 flex-1 mr-2 shadow-md">
                  <Text className="text-center font-semibold">Follow</Text>
                </TouchableOpacity>
                <TouchableOpacity className="bg-white rounded-[30px] py-2 px-4 flex-1 shadow-md">
                  <Text className="text-center font-semibold">Message</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        
        <View className="mt-4 bg-white/70 rounded-3xl mx-2 p-4 shadow-md">
          <Text className="text-lg font-semibold mb-2">Posts</Text>
          
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
                    <View className="bg-gray-200 w-full h-full rounded-md overflow-hidden">
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
                      <View className="bg-gray-100 w-full h-full rounded-md" />
                    </View>
                  ))
                }
              </View>
              
              {totalPages > 1 && (
                <View className="flex-row justify-center py-4">
                  {Array(totalPages).fill(0).map((_, index) => (
                    <TouchableOpacity 
                      key={index}
                      onPress={() => handlePageChange(index)}
                    >
                      <View 
                        className={`h-2 w-2 rounded-full mx-1 ${
                          index === currentPage ? 'bg-[#E4CAC7]' : 'bg-gray-300'
                        }`} 
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      
      <TouchableOpacity 
        className="absolute bottom-6 right-6 bg-[#E4CAC7] w-14 h-14 rounded-full items-center justify-center shadow-lg"
        onPress={() => navigation.navigate('NewPost')}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
}