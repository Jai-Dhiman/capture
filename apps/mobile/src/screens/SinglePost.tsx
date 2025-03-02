import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import SavePostIcon from '../assets/icons/Favorites Icon.svg'
import SettingsIcon from '../assets/icons/Settings Icon.svg'
import { ProfileImage } from '../components/media/ProfileImage';
import { PostMediaGallery } from '../components/media/PostMediaGallery';
import { HashtagDisplay } from '../components/hashtags/HashtagDisplay';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type SinglePostRouteProp = RouteProp<AppStackParamList, 'SinglePost'>;

export default function SinglePost() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SinglePostRouteProp>();
  const post = route.params.post;
  
  if (!post) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Post not found</Text>
      </View>
    );
  }
  console.log('Post hashtags:', post.hashtags);
  return (
    <View className="flex-1">
      <Image
        source={require('../assets/Fluid Background Coffee.png')}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
        resizeMode="cover"
      />
      
      <View className="flex-row items-center p-4 bg-transparent">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-[30px] font-light mx-auto">Capture</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView className="flex-1">
        <View className="flex-row items-center p-3 border-b border-gray-100 bg-white">
          <View className="w-8 h-8 rounded-full overflow-hidden mr-2">
          {post.user?.profileImage ? (
              <ProfileImage cloudflareId={post.user.profileImage} />
            ) : (
              <View className="w-full h-full bg-gray-200" />
            )}
          </View>
          <Text className="font-medium">{post.user?.username || 'User'}</Text>
          
          <TouchableOpacity className="ml-auto">
            <SettingsIcon width={24} height={24} />
          </TouchableOpacity>
        </View>
        
        <View className="w-full bg-white">
        {post.media && post.media.length > 0 ? (
          <View className="h-[50vh]">
            <PostMediaGallery 
              mediaItems={post.media} 
              containerStyle={{ height: '100%' }} 
            />
          </View>
        ) : (
          <View className="h-[50vh] bg-gray-100 justify-center items-center">
            <Text className="text-gray-400">No image</Text>
          </View>
        )}
      </View>
      
      <View className="p-4 border-b border-gray-200 bg-white">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-4">
          <Text className="text-base">{post.content}</Text>
          
          {post.hashtags && post.hashtags.length > 0 && (
            <HashtagDisplay hashtags={post.hashptags} size="medium" />
          )}
        </View>
        
        <TouchableOpacity className="mr-4">
          <Ionicons name="chatbubble-outline" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity>
          <SavePostIcon width={24} height={24} />
        </TouchableOpacity>
      </View>
    </View>
        
        <View className="p-4 bg-white max-h-24">
          <View className="py-1">
            <Text className="text-gray-500 text-center">No comments yet</Text>
          </View>
          
          <Text className="text-xs text-gray-500 mt-2">
            {new Date(post.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}