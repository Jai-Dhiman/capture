import { Image, type ImageProps } from 'expo-image';
import type React from 'react';
import { useState, useEffect, memo } from 'react';
import { View, Dimensions, type ViewStyle, type DimensionValue } from 'react-native';
import { SkeletonElement } from '../../../shared/components/SkeletonLoader';

interface ResponsiveImageProps extends Omit<ImageProps, 'source' | 'style'> {
  source: string | { uri: string };
  width?: number;
  height?: number;
  aspectRatio?: number;
  priority?: 'low' | 'normal' | 'high';
  placeholder?: string;
  blurHash?: string;
  circle?: boolean;
  fallback?: React.ReactNode;
  lazy?: boolean;
  enableBlur?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  style?: ViewStyle;
}

const ResponsiveImageComponent = ({
  source,
  width,
  height,
  aspectRatio = 1,
  priority = 'normal',
  placeholder,
  blurHash,
  circle = false,
  fallback,
  lazy = true,
  enableBlur = true,
  onLoad,
  onError,
  style,
  ...props
}: ResponsiveImageProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [shouldLoad, setShouldLoad] = useState(!lazy || priority);

  // Get screen dimensions for responsive sizing
  const screenWidth = Dimensions.get('window').width;

  // Generate responsive source set based on screen dimensions
  const generateResponsiveSource = () => {
    const uri = typeof source === 'string' ? source : source.uri;

    // For R2 CDN URLs, they're already optimized - just return as-is
    // The variant selection happens at the hook level (useImageUrl)
    return { uri };
  };

  // Calculate container dimensions
  useEffect(() => {
    if (width && height) {
      setDimensions({ width, height });
    } else if (width) {
      setDimensions({ width, height: width * aspectRatio });
    } else {
      // Use screen width with aspect ratio
      const calculatedWidth = screenWidth;
      setDimensions({ width: calculatedWidth, height: calculatedWidth * aspectRatio });
    }
  }, [width, height, aspectRatio, screenWidth]);

  // Simple lazy loading trigger - in a full implementation, this would use IntersectionObserver
  useEffect(() => {
    if (lazy && !priority && !shouldLoad) {
      // For beta version, use a simple timeout to simulate viewport detection
      const timer = setTimeout(() => {
        setShouldLoad(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [lazy, priority, shouldLoad]);

  const handleLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setImageError(true);
    onError?.();
  };

  // Generate a simple blur placeholder for better UX
  const generateBlurPlaceholder = () => {
    if (blurHash) {
      return blurHash;
    }

    if (!enableBlur) {
      return undefined;
    }

    // Generate a simple base64-encoded blur placeholder
    // TODO: In a full implementation, this would be generated server-side
    const canvas = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    return canvas;
  };

  // Container styles
  const containerStyle: ViewStyle[] = [
    {
      width: dimensions.width > 0 ? dimensions.width : '100%' as DimensionValue,
      height: dimensions.height > 0 ? dimensions.height : undefined,
      borderRadius: circle ? 9999 : 16,
      overflow: 'hidden' as const,
    },
    style,
  ].filter(Boolean) as ViewStyle[];

  // Show error fallback
  if (imageError) {
    return (
      <View style={containerStyle}>
        {fallback || (
          <View className="bg-gray-200 flex-1 justify-center items-center">
            <SkeletonElement width="100%" height="100%" radius={circle ? 'round' : 8} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {/* Loading placeholder */}
      {(!imageLoaded || !shouldLoad) && (
        <View className="absolute inset-0 z-10">
          <SkeletonElement width="100%" height="100%" radius={circle ? 'round' : 8} />
        </View>
      )}

      {/* Main image - only render when shouldLoad is true */}
      {shouldLoad && (
        <Image
          source={generateResponsiveSource()}
          style={{
            width: '100%',
            height: '100%',
          }}
          contentFit="cover"
          priority={priority ? 'high' : 'normal'}
          placeholder={placeholder || generateBlurPlaceholder()}
          transition={imageLoaded ? 300 : 0}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      )}
    </View>
  );
};

export const ResponsiveImage = memo(ResponsiveImageComponent, (prevProps, nextProps) => {
  const prevSource = typeof prevProps.source === 'string' ? prevProps.source : prevProps.source.uri;
  const nextSource = typeof nextProps.source === 'string' ? nextProps.source : nextProps.source.uri;

  return (
    prevSource === nextSource &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.aspectRatio === nextProps.aspectRatio &&
    prevProps.priority === nextProps.priority
  );
});