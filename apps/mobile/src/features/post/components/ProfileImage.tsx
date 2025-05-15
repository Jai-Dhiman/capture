import React from 'react';
import { View } from 'react-native';
import { MediaImage } from './MediaImage';
import { SkeletonElement } from '../../../shared/components/SkeletonLoader';

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
        <SkeletonElement width="100%" height="100%" radius={9999} />
      </View>
    );
  }

  const profileStyle = {
    ...style,
    borderRadius: 9999,
    width: '100%',
    height: '100%'
  };

  return <MediaImage media={cloudflareId} style={profileStyle} expirySeconds={expirySeconds} priority={true} circle />;
};