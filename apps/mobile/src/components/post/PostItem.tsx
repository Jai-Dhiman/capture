import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { PostMediaGallery } from './PostMediaGallery';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../Navigators/types/navigation';
import { HashtagDisplay } from '../hashtags/HashtagDisplay';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface PostItemProps {
  post: any;
}

export const PostItem = ({ post }: PostItemProps) => {
  const navigation = useNavigation<NavigationProp>();
  
  return (
    <TouchableOpacity 
      className="bg-white p-4 mb-4 rounded-lg shadow"
      onPress={() => navigation.navigate('SinglePost', { post })}
    >
      {post.media && post.media.length > 0 && (
        <PostMediaGallery mediaItems={post.media} />
      )}
      <Text className="text-base">{post.content}</Text>
      
      {post.hashtags && post.hashtags.length > 0 && (
        <HashtagDisplay hashtags={post.hashtags} size="small" />
      )}
      
      <Text className="text-sm text-gray-500 mt-2">
        {new Date(post.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );
};