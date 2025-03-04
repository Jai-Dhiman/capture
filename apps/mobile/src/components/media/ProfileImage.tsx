import React from 'react';
import { MediaImage } from './MediaImage';

interface ProfileImageProps {
  cloudflareId: string;
  style?: any;
  expirySeconds?: number;
}

export const ProfileImage = ({ cloudflareId, style = {}, expirySeconds = 1800 }: ProfileImageProps) => {
  return <MediaImage media={cloudflareId} style={style} expirySeconds={expirySeconds} />;
};