import React from 'react';
import { View, Text, Image } from 'react-native';
import { useImageUrl } from '../hooks/useImageUrl';

interface MediaImageProps {
  media: any;
  style?: any;
}

export const MediaImage = ({ media, style = {} }: MediaImageProps) => {
  const { data: imageUrl, isLoading, error } = useImageUrl(media.id);
  
  if (isLoading) {
    return <View className="bg-gray-200 flex-1 rounded-lg"><Text className="text-center p-2">Loading...</Text></View>;
  }

  if (error || !imageUrl) {
    return <View className="bg-gray-200 flex-1 rounded-lg"><Text className="text-center p-2">Failed to load</Text></View>;
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      className="flex-1 rounded-lg"
      style={{ aspectRatio: 1, ...style }}
      resizeMode="cover"
    />
  );
};