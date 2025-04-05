import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { FlatGrid } from 'react-native-super-grid';
import { MediaImage } from '../media/MediaImage';
import { SkeletonElement } from '../ui/SkeletonLoader';

interface PostsGridProps {
  posts: any[];
  itemSize: number;
  spacing: number;
  onPostPress: (post: any) => void;
  isLoading?: boolean;
}

export const PostsGrid: React.FC<PostsGridProps> = ({
  posts,
  itemSize,
  spacing,
  onPostPress,
  isLoading = false
}) => {
  const { width } = Dimensions.get('window');
  
  if (isLoading) {
    return (
      <View className="flex-row flex-wrap">
        {Array(9).fill(0).map((_, index) => (
          <View 
            key={index} 
            style={{ 
              width: itemSize, 
              height: itemSize, 
              marginRight: (index + 1) % 3 !== 0 ? spacing : 0,
              marginBottom: spacing 
            }}
          >
            <SkeletonElement 
              width="100%" 
              height="100%" 
              radius={10} 
            />
          </View>
        ))}
      </View>
    );
  }
  
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