import React from 'react';
import { View, Dimensions } from 'react-native';
import { MediaImage } from '../media/MediaImage';

interface PostMediaGalleryProps {
  mediaItems: any[];
  containerStyle?: any;
}

export const PostMediaGallery = ({ mediaItems, containerStyle = {} }: PostMediaGalleryProps) => {
  if (!mediaItems || mediaItems.length === 0) {
    return null;
  }
  
  const displayItems = mediaItems.slice(0, 4);
  const imageCount = displayItems.length;
  
  if (imageCount === 1) {
    return (
      <View className="w-full h-full rounded-lg" style={containerStyle}>
        <MediaImage media={displayItems[0]} priority={true} />
      </View>
    );
  }
  
  if (imageCount === 2) {
    return (
      <View className="w-full h-full flex-row" style={containerStyle}>
        <View className="flex-1 pr-1">
          <MediaImage media={displayItems[0]} priority={true} />
        </View>
        <View className="flex-1 pl-1">
          <MediaImage media={displayItems[1]} priority={true} />
        </View>
      </View>
    );
  }
  
  if (imageCount === 3) {
    return (
      <View className="w-full h-full flex-row" style={containerStyle}>
        <View className="flex-1 pr-1">
          <MediaImage media={displayItems[0]} priority={true} />
        </View>
        <View className="flex-1 px-1">
          <MediaImage media={displayItems[1]} priority={true} />
        </View>
        <View className="flex-1 pl-1">
          <MediaImage media={displayItems[2]} priority={true} />
        </View>
      </View>
    );
  }
  
  return (
    <View className="w-full h-full" style={containerStyle}>
      <View className="flex-1 flex-row mb-1">
        <View className="flex-1 mr-1">
          <MediaImage media={displayItems[0]} priority={true} />
        </View>
        <View className="flex-1 ml-1">
          <MediaImage media={displayItems[1]} priority={true} />
        </View>
      </View>
      <View className="flex-1 flex-row mt-1">
        <View className="flex-1 mr-1">
          <MediaImage media={displayItems[2]} priority={true} />
        </View>
        <View className="flex-1 ml-1">
          <MediaImage media={displayItems[3]} priority={true} />
        </View>
      </View>
    </View>
  );
};