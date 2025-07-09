import { useImageUrl } from './useMedia';
import { Dimensions, PixelRatio } from 'react-native';

/**
 * Hook to get the appropriate image variant based on screen size and pixel density
 */
export const useResponsiveMediaUrl = (mediaId?: string, targetWidth?: number) => {
  const screenWidth = Dimensions.get('window').width;
  const pixelRatio = PixelRatio.get();
  
  // Calculate the optimal variant based on screen size and pixel density
  const getOptimalVariant = () => {
    const effectiveWidth = targetWidth || screenWidth;
    const scaledWidth = effectiveWidth * pixelRatio;
    
    // Choose variant based on scaled width
    if (scaledWidth <= 400) return 'small';
    if (scaledWidth <= 800) return 'medium';
    return 'large';
  };
  
  const variant = getOptimalVariant();
  const format = 'webp'; // Always use WebP for best compression
  
  return useImageUrl(mediaId ? { id: mediaId } : null, variant, true);
};

/**
 * Hook specifically for thumbnails (always small variant)
 */
export const useThumbnailUrl = (mediaId?: string) => {
  return useImageUrl(mediaId ? { id: mediaId } : null, 'small', true);
};

/**
 * Hook for high-quality images (always large variant)
 */
export const useHighQualityUrl = (mediaId?: string) => {
  return useImageUrl(mediaId ? { id: mediaId } : null, 'large', true);
};