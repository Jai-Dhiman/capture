import React from 'react';
import { View, Text } from 'react-native';
import { PostMediaGallery } from './PostMediaGallery';

interface PostItemProps {
  post: any;
}

export const PostItem = ({ post }: PostItemProps) => {
  return (
    <View className="bg-white p-4 mb-4 rounded-lg shadow">
      {post.media && post.media.length > 0 && (
        <PostMediaGallery mediaItems={post.media} />
      )}
      <Text className="text-base">{post.content}</Text>
      <Text className="text-sm text-gray-500 mt-2">
        {new Date(post.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );
};