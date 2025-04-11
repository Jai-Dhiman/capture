import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { MediaImage } from '../media/MediaImage';

interface PostMediaGalleryProps {
  mediaItems: any[];
  containerStyle?: any;
}

const imageStyle = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4
  }
});

export const PostMediaGallery = ({ mediaItems, containerStyle = {} }: PostMediaGalleryProps) => {
  if (!mediaItems || mediaItems.length === 0) {
    return null;
  }
  
  const displayItems = mediaItems.slice(0, 4);
  const imageCount = displayItems.length;
  
  if (imageCount === 1) {
    return (
      <View 
        className="w-full h-full rounded-2xl overflow-hidden" 
        style={[imageStyle.container, containerStyle]}
      >
        <MediaImage media={displayItems[0]} priority={true} />
      </View>
    );
  }
  
  if (imageCount === 2) {
    return (
      <View className="w-full h-full flex-row space-x-2" style={containerStyle}>
        <View className="flex-1" style={imageStyle.container}>
          <MediaImage media={displayItems[0]} priority={true} />
        </View>
        <View className="flex-1" style={imageStyle.container}>
          <MediaImage media={displayItems[1]} priority={true} />
        </View>
      </View>
    );
  }
  
  if (imageCount === 3) {
    return (
      <View className="w-full h-full flex-row space-x-2" style={containerStyle}>
        <View className="flex-1" style={imageStyle.container}>
          <MediaImage media={displayItems[0]} priority={true} />
        </View>
        <View className="flex-1" style={imageStyle.container}>
          <MediaImage media={displayItems[1]} priority={true} />
        </View>
        <View className="flex-1" style={imageStyle.container}>
          <MediaImage media={displayItems[2]} priority={true} />
        </View>
      </View>
    );
  }
  
  return (
    <View className="w-full h-full" style={containerStyle}>
      <View className="flex-1 flex-row space-x-2 mb-2">
        <View className="flex-1" style={imageStyle.container}>
          <MediaImage media={displayItems[0]} priority={true} />
        </View>
        <View className="flex-1" style={imageStyle.container}>
          <MediaImage media={displayItems[1]} priority={true} />
        </View>
      </View>
      <View className="flex-1 flex-row space-x-2 mt-2">
        <View className="flex-1" style={imageStyle.container}>
          <MediaImage media={displayItems[2]} priority={true} />
        </View>
        <View className="flex-1" style={imageStyle.container}>
          <MediaImage media={displayItems[3]} priority={true} />
        </View>
      </View>
    </View>
  );
};