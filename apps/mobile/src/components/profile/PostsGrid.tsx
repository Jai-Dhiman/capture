import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { FlatGrid } from 'react-native-super-grid';
import { MediaImage } from '../media/MediaImage';

interface PostsGridProps {
  posts: any[];
  itemSize: number;
  spacing: number;
  onPostPress: (post: any) => void;
}

export const PostsGrid: React.FC<PostsGridProps> = ({
  posts,
  itemSize,
  spacing,
  onPostPress
}) => {
  const { width } = Dimensions.get('window');
  
  return (
    <FlatGrid
      itemDimension={itemSize}
      spacing={spacing}
      data={posts}
      renderItem={({ item: post }) => (
        <TouchableOpacity 
          key={post.id} 
          onPress={() => onPostPress(post)}
        >
          <View className="w-full bg-stone-400 rounded-[10px] overflow-hidden" style={{ aspectRatio: 1 }}>
            {post.media && post.media.length > 0 ? (
              <MediaImage media={post.media[0]} />
            ) : (
              <View className="flex-1 justify-center items-center">
                <Text className="text-white opacity-70">No image</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
};