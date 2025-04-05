import React from 'react';
import { View } from 'react-native';
import { MediaImage } from './MediaImage';
import { SkeletonElement } from '../ui/SkeletonLoader';

interface ProfileImageProps {
  cloudflareId: string;
  style?: any;
  expirySeconds?: number;
  isLoading?: boolean;
}

export const ProfileImage = ({ cloudflareId, style = {}, expirySeconds = 1800, isLoading = false }: ProfileImageProps) => {
  if (isLoading) {
    return (
      <View className="w-full h-full rounded-full overflow-hidden">
        <SkeletonElement width="100%" height="100%" radius="round" />
      </View>
    );
  }
  
  return <MediaImage media={cloudflareId} style={style} expirySeconds={expirySeconds} />;
};