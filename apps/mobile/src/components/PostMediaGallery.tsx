import React, { useState } from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { MediaImage } from './MediaImage';

const { width } = Dimensions.get('window');

interface PostMediaGalleryProps {
  mediaItems: any[];
  containerStyle?: any;
}

export const PostMediaGallery = ({ mediaItems, containerStyle = {} }: PostMediaGalleryProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  
  if (!mediaItems || mediaItems.length === 0) {
    return null;
  }
  
  // Single image display
  if (mediaItems.length === 1) {
    return (
      <View className="w-full h-48 rounded-lg mb-2" style={containerStyle}>
        <MediaImage media={mediaItems[0]} />
      </View>
    );
  }
  
  // 2-4 images grid display
  if (mediaItems.length >= 2 && mediaItems.length <= 4) {
    return (
      <View className="w-full h-48 mb-2 flex-row flex-wrap" style={containerStyle}>
        {mediaItems.map((media, index) => {
          const isLastInOdd = mediaItems.length === 3 && index === 2;
          
          return (
            <View 
              key={media.id} 
              className={`${isLastInOdd ? 'w-full' : 'w-1/2'} ${index < 2 ? 'h-24' : 'h-24'}`}
              style={{ padding: 2 }}
            >
              <MediaImage media={media} />
            </View>
          );
        })}
      </View>
    );
  }
  
  // 5+ images carousel display
  return (
    <View className="w-full h-48 mb-2" style={containerStyle}>
      <ScrollView 
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
          setActiveIndex(newIndex);
        }}
      >
        {mediaItems.map((media) => (
          <View key={media.id} style={{ width: width - 40, height: 192 }} className="pr-2">
            <MediaImage media={media} />
          </View>
        ))}
      </ScrollView>
      
      {/* Pagination dots */}
      <View className="flex-row justify-center mt-2">
        {mediaItems.map((_, index) => (
          <View 
            key={index} 
            className={`h-2 w-2 rounded-full mx-1 ${index === activeIndex ? 'bg-blue-500' : 'bg-gray-300'}`} 
          />
        ))}
      </View>
    </View>
  );
};