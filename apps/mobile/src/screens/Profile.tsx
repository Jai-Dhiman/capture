import React, { useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { useSessionStore } from '../stores/sessionStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { useUserPosts } from '../hooks/useUserPosts';
import { MediaImage } from '../components/media/MediaImage';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
const { width } = Dimensions.get('window');
const POSTS_PER_PAGE = 4;

export default function Profile() {
  const navigation = useNavigation<NavigationProp>();
  const { authUser, userProfile } = useSessionStore();
  const { data: posts, isLoading, refetch } = useUserPosts(authUser?.id);
  const [currentPage, setCurrentPage] = useState(0);
  
  const isOwnProfile = true; // For now, we'll assume this is the user's own profile
  
  // Calculate total pages
  const totalPages = posts ? Math.ceil(posts.length / POSTS_PER_PAGE) : 0;
  
  // Get current page posts
  const currentPosts = posts ? 
    posts.slice(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE) : 
    [];
  
  // Handle pagination
  const handlePageChange = (pageIndex: number) => {
    setCurrentPage(pageIndex);
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.navigate('Feed')}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-xl font-bold mx-auto">CAPTURE</Text>
        <View style={{ width: 24 }} /> {/* Empty view for centering */}
      </View>
      
      <ScrollView>
        {/* Profile Section */}
        <View className="p-4">
          <View className="flex-row items-center">
            <Image 
              // source={userProfile?.image ? { uri: userProfile.image } : require('../../assets/default-avatar.png')} 
              className="w-20 h-20 rounded-full bg-gray-200"
            />
            <View className="ml-4 flex-1">
              <Text className="text-xl font-bold">{userProfile?.username || 'Username'}</Text>
              <Text className="text-gray-600 mt-1">{userProfile?.bio || 'No bio yet'}</Text>
            </View>
          </View>
          
          {/* Action Buttons */}
          <View className="flex-row mt-4">
            {isOwnProfile ? (
              <TouchableOpacity 
                className="bg-gray-200 rounded-lg py-2 px-4 flex-1"
                // onPress={() => navigation.navigate('Settings')}
              >
                <Text className="text-center font-semibold">Settings</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity className="bg-blue-500 rounded-lg py-2 px-4 flex-1 mr-2">
                  <Text className="text-center text-white font-semibold">Follow</Text>
                </TouchableOpacity>
                <TouchableOpacity className="bg-gray-200 rounded-lg py-2 px-4 flex-1">
                  <Text className="text-center font-semibold">Message</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        
        {/* Divider */}
        <View className="h-2 bg-gray-100" />
        
        {/* Posts Grid */}
        <View className="p-2">
          <Text className="text-lg font-semibold mb-2 px-2">Posts</Text>
          
          {isLoading ? (
            <Text className="text-center py-4 text-gray-500">Loading posts...</Text>
          ) : posts?.length === 0 ? (
            <Text className="text-center py-4 text-gray-500">No posts yet</Text>
          ) : (
            <>
              <View className="flex-row flex-wrap">
                {currentPosts.map((post: { id: string; media?: Array<{ url: string }> }, index: number) => (
                  <TouchableOpacity 
                    key={post.id} 
                    className="w-1/2 aspect-square p-1"
                    // onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
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
                
                {/* Fill with empty boxes if needed */}
                {currentPosts.length < POSTS_PER_PAGE && 
                  Array(POSTS_PER_PAGE - currentPosts.length).fill(0).map((_, index) => (
                    <View key={`empty-${index}`} className="w-1/2 aspect-square p-1">
                      <View className="bg-gray-100 w-full h-full rounded-md" />
                    </View>
                  ))
                }
              </View>
              
              {/* Pagination Dots */}
              {totalPages > 1 && (
                <View className="flex-row justify-center py-4">
                  {Array(totalPages).fill(0).map((_, index) => (
                    <TouchableOpacity 
                      key={index}
                      onPress={() => handlePageChange(index)}
                    >
                      <View 
                        className={`h-2 w-2 rounded-full mx-1 ${
                          index === currentPage ? 'bg-blue-500' : 'bg-gray-300'
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
      
      {/* New Post Button */}
      <TouchableOpacity 
        className="absolute bottom-6 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
        onPress={() => navigation.navigate('NewPost')}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
}