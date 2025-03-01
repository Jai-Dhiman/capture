import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { MediaImage } from '../components/media/MediaImage';
import { ProfileImage } from '../components/media/ProfileImage';
import { PostMediaGallery } from '../components/media/PostMediaGallery';
import { LoadingSpinner } from '../components/LoadingSpinner';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type SinglePostRouteProp = RouteProp<AppStackParamList, 'SinglePost'>;

export default function SinglePost() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SinglePostRouteProp>();
  const post = route.params.post;
  const [isSaved, setIsSaved] = useState(false);
  const [comment, setComment] = useState('');
  
  if (!post) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Post not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header with back button and Capture title */}
      <View className="flex-row items-center p-4 border-b border-gray-200 bg-[#E4CAC7]">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text className="text-xl font-bold mx-auto">CAPTURE</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView>
        {/* User profile banner */}
        <View className="flex-row items-center p-3 border-b border-gray-100">
          <View className="w-8 h-8 rounded-full overflow-hidden mr-2">
            {post.user?.profileImage ? (
              <ProfileImage cloudflareId={post.user.profileImage} />
            ) : (
              <View className="w-full h-full bg-gray-200" />
            )}
          </View>
          <Text className="font-medium">{post.user?.username || 'User'}</Text>
        </View>
        
        {/* Post media */}
        <View className="w-full">
          {post.media && post.media.length > 0 ? (
            <PostMediaGallery mediaItems={post.media} />
          ) : (
            <View className="h-48 bg-gray-100 justify-center items-center">
              <Text className="text-gray-400">No image</Text>
            </View>
          )}
        </View>
        
        {/* Post content and actions */}
        <View className="flex-row p-4 border-b border-gray-200">
          <View className="flex-1 pr-4">
            <Text className="text-base">{post.content}</Text>
            <Text className="text-xs text-gray-500 mt-2">
              {new Date(post.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setIsSaved(!isSaved)}
            className="items-center justify-center"
          >
            <Ionicons 
              name={isSaved ? "bookmark" : "bookmark-outline"} 
              size={24} 
              color={isSaved ? "#E4CAC7" : "#333"} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Comments section */}
        <View className="p-4">
          <Text className="font-semibold mb-4">Comments</Text>
          
          {/* Placeholder for comments */}
          <View className="py-2">
            <Text className="text-gray-500 text-center">No comments yet</Text>
          </View>
          
          {/* Comment input */}
          <View className="flex-row mt-4 items-center border rounded-full p-2 bg-gray-50">
            <TextInput
              className="flex-1 px-2"
              placeholder="Add a comment..."
              value={comment}
              onChangeText={setComment}
            />
            <TouchableOpacity 
              className="bg-[#E4CAC7] rounded-full p-2"
              disabled={!comment.trim()}
            >
              <Ionicons name="send" size={18} color={comment.trim() ? "#333" : "#ccc"} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}