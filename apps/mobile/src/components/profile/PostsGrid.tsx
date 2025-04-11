import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
      style={[
        styles.gridItem,
        { width: itemSize, height: itemSize }
      ]}
      activeOpacity={0.9}
    >
      <View 
        className="bg-stone-400 rounded-2xl overflow-hidden" 
        style={{ 
          width: '100%', 
          height: '100%',
          borderRadius: 16
        }}
      >
        {post.media && post.media.length > 0 ? (
          <MediaImage media={post.media[0]} priority={true} />
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-white opacity-70">No image</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gridItem: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    backgroundColor: 'transparent',
  }
});

export const PostsGrid = memo(GridItem, (prevProps, nextProps) => {
  return prevProps.post.id === nextProps.post.id && prevProps.itemSize === nextProps.itemSize;
});