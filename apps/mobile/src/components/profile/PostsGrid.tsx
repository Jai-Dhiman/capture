import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MediaImage } from '../media/MediaImage';

interface GridItemProps {
  post: any;
  onPress: (post: any) => void;
  itemSize: number;
}

const GridItem = ({ post, onPress, itemSize }: GridItemProps) => {
  return (
    <TouchableOpacity 
      onPress={() => onPress(post)}
    >
      <View 
        className="w-full bg-stone-400 rounded-[10px] overflow-hidden" 
        style={{ aspectRatio: 1, width: itemSize }}
      >
        {post.media && post.media.length > 0 ? (
          <MediaImage media={post.media[0]} />
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-white opacity-70">No image</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const PostsGrid = memo(GridItem, (prevProps, nextProps) => {
  return prevProps.post.id === nextProps.post.id && prevProps.itemSize === nextProps.itemSize;
});