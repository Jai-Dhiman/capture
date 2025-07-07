import { SkeletonElement } from '@/shared/components/SkeletonLoader';
import { useQueryClient } from '@tanstack/react-query';
import { MotiView } from 'moti';
import React, { useState, useEffect, memo } from 'react';
import { Dimensions, Image, Modal, Pressable, Text, View } from 'react-native';
import { State as GestureState, LongPressGestureHandler } from 'react-native-gesture-handler';
import { useResponsiveMediaUrl } from '../hooks/useResponsiveMedia';

interface MediaImageProps {
  media: any;
  style?: any;
  width?: number; // For variant selection
  priority?: boolean;
  circle?: boolean;
}

const MediaImageComponent = ({
  media,
  style = {},
  width,
  circle = false,
}: MediaImageProps) => {
  const queryClient = useQueryClient();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Extract media ID from media object or string
  const mediaId = typeof media === 'string' ? media : media?.id;
  const { data: imageUrl, isLoading, error, isStale } = useResponsiveMediaUrl(mediaId, width);

  useEffect(() => {
    if (imageUrl && !isStale) {
      // R2 CDN URLs are cached for 1 hour, refresh at 45 minutes
      const refreshTime = 45 * 60 * 1000;
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ['imageUrl', mediaId, 'medium', 'webp'] // Match the new query key format
        });
      }, refreshTime);

      return () => clearTimeout(timer);
    }
  }, [imageUrl, mediaId, isStale, queryClient]);

  if (isLoading) {
    const containerClass = circle
      ? 'bg-gray-200 flex-1 rounded-full'
      : 'bg-gray-200 flex-1 rounded-lg';
    const radiusValue = circle ? 'round' : 8;
    return (
      <View className={containerClass}>
        <SkeletonElement width="100%" height="100%" radius={radiusValue} />
      </View>
    );
  }

  if (error || !imageUrl) {
    return (
      <View className="bg-gray-200 flex-1 rounded-lg">
        <Text className="text-center p-2">Failed to load</Text>
      </View>
    );
  }

  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;

  return (
    <>
      <Modal
        visible={isFullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPressOut={() => setIsFullscreen(false)}
        >
          <MotiView
            from={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'timing', duration: 180 }}
            style={{
              width: windowWidth,
              height: windowHeight,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                overflow: 'hidden',
                borderRadius: 20,
                width: windowWidth * 0.95,
                height: 'auto',
                maxHeight: windowHeight * 0.8,
                backgroundColor: '#fff',
              }}
            >
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', aspectRatio: 1 }}
                resizeMode="cover"
              />
            </View>
          </MotiView>
        </Pressable>
      </Modal>
      <LongPressGestureHandler
        minDurationMs={300}
        onHandlerStateChange={(evt) => {
          if (evt.nativeEvent.state === GestureState.ACTIVE) setIsFullscreen(true);
        }}
      >
        <View style={{ flex: 1 }}>
          {!imageLoaded && (
            <View
              className={`absolute top-0 left-0 right-0 bottom-0 bg-gray-200 flex-1 ${
                circle ? 'rounded-full' : 'rounded-lg'
              }`}
            >
              <SkeletonElement width="100%" height="100%" radius={circle ? 'round' : 8} />
            </View>
          )}
          <Image
            source={{ uri: imageUrl }}
            className="flex-1"
            style={[{ borderRadius: 16 }, style]}
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
          />
        </View>
      </LongPressGestureHandler>
    </>
  );
};

export const MediaImage = memo(MediaImageComponent, (prevProps, nextProps) => {
  if (typeof prevProps.media === 'string' && typeof nextProps.media === 'string') {
    return prevProps.media === nextProps.media;
  }
  if (prevProps.media?.id && nextProps.media?.id) {
    return prevProps.media.id === nextProps.media.id;
  }
  return false;
});
