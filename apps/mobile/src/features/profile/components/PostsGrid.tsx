import { MediaImage } from '@/features/post/components/MediaImage';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface GridItemProps {
  post: any;
  onPress: (post: any) => void;
  itemSize: number;
}

const GridItem = ({ post, onPress, itemSize }: GridItemProps) => {
  return (
    <TouchableOpacity
      onPress={() => onPress(post)}
      style={{
        width: itemSize,
        height: itemSize,
        padding: 0.5,
        backgroundColor: 'transparent',
      }}
      activeOpacity={0.9}
    >
      <View
        className="bg-stone-400 rounded-2xl overflow-hidden"
        style={[
          styles.shadowContainer,
          {
            width: '100%',
            height: '100%',
            borderRadius: 16,
          },
        ]}
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
  shadowContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
});

export const PostsGrid = memo(GridItem, (prevProps, nextProps) => {
  return prevProps.post.id === nextProps.post.id && prevProps.itemSize === nextProps.itemSize;
});
