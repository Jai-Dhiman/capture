import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { useImageUrl } from '../hooks/useImageUrl';
import { useQueryClient } from '@tanstack/react-query';

interface MediaImageProps {
  media: any;
  style?: any;
  expirySeconds?: number;
}

export const MediaImage = ({ media, style = {}, expirySeconds = 1800 }: MediaImageProps) => {
  const queryClient = useQueryClient();
  const { data: imageUrl, isLoading, error, isStale } = useImageUrl(media.id, expirySeconds);
  
  useEffect(() => {
    if (imageUrl && !isStale) {
      const refreshTime = expirySeconds * 0.8 * 1000;
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['imageUrl', media.id, expirySeconds] });
      }, refreshTime);
      
      return () => clearTimeout(timer);
    }
  }, [imageUrl, media.id, expirySeconds, isStale, queryClient]);
  
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