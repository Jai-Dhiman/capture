import React, { useState, useRef } from 'react';
import { View, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { MediaImage } from '../media/MediaImage';

interface PostMediaGalleryProps {
  mediaItems: any[];
  containerStyle?: any;
}

export const PostMediaGallery = ({ mediaItems, containerStyle = {} }: PostMediaGalleryProps) => {
  const { width } = Dimensions.get('window');
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  if (!mediaItems || mediaItems.length === 0) {
    return null;
  }
  
  if (mediaItems.length === 1) {
    return (
      <View className="w-full h-full rounded-lg" style={containerStyle}>
        <MediaImage media={mediaItems[0]} />
      </View>
    );
  }

  return (
    <View className="w-full h-full" style={containerStyle}>
      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const contentOffset = e.nativeEvent.contentOffset;
          const viewSize = e.nativeEvent.layoutMeasurement;
          const newIndex = Math.floor(contentOffset.x / viewSize.width);
          if (newIndex !== activeIndex) {
            setActiveIndex(newIndex);
          }
        }}
        scrollEventThrottle={16}
      >
        {mediaItems.map((media) => (
          <View 
            key={media.id} 
            style={{ width, height: '100%' }} 
          >
            <MediaImage 
              media={media} 
              expirySeconds={3600} 
            />
          </View>
        ))}
      </ScrollView>
      
      {mediaItems.length > 1 && (
        <View className="h-6 bg-white/80 absolute bottom-0 left-0 right-0 flex-row justify-center items-center">
          {mediaItems.map((_, index) => (
            <TouchableOpacity 
              key={index} 
              onPress={() => {
                scrollViewRef.current?.scrollTo({ 
                  x: width * index, 
                  animated: true 
                });
              }}
            >
              <View 
                className={`h-2 rounded-full mx-1 ${index === activeIndex ? 'w-4 bg-[#E4CAC7]' : 'w-2 bg-gray-300'}`} 
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};