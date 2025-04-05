import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { useMediaSource } from '../../hooks/useMedia';
import { useQueryClient } from '@tanstack/react-query';
import { SkeletonLoader, SkeletonElement } from '../ui/SkeletonLoader';

interface MediaImageProps {
  media: any;
  style?: any;
  expirySeconds?: number;
}

export const MediaImage = ({ media, style = {}, expirySeconds = 1800 }: MediaImageProps) => {
  const queryClient = useQueryClient();
  const { data: imageUrl, isLoading, error, isStale } = useMediaSource(media, expirySeconds);
  
  useEffect(() => {
    if (imageUrl && !isStale) {
      const refreshTime = expirySeconds * 0.8 * 1000;
      const timer = setTimeout(() => {
        const queryKey = typeof media === 'string' 
          ? ['cloudflareImageUrl', media, expirySeconds]
          : media.storageKey 
            ? ['cloudflareImageUrl', media.storageKey, expirySeconds]
            : ['imageUrl', media.id, expirySeconds];
            
        queryClient.invalidateQueries({ queryKey });
      }, refreshTime);
      
      return () => clearTimeout(timer);
    }
  }, [imageUrl, media, expirySeconds, isStale, queryClient]);
  
  if (isLoading) {
    return (
      <View className="bg-gray-200 flex-1 rounded-lg">
        <SkeletonElement width="100%" height="100%" radius={8} />
      </View>
    );
  }

  if (error || !imageUrl) {
    return <View className="bg-gray-200 flex-1 rounded-lg"><Text className="text-center p-2">Failed to load</Text></View>;
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      className="flex-1 rounded-sm"
      style={style}
      resizeMode="cover"
    />
  );
};