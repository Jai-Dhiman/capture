import React, { useState, useEffect, memo } from 'react';
import { View, Text, Image, Modal, Pressable, Dimensions } from 'react-native';
import { useMediaSource } from '../../hooks/useMedia';
import { useQueryClient } from '@tanstack/react-query';
import { SkeletonElement } from '../ui/SkeletonLoader';
import { LongPressGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { MotiView } from 'moti';

interface MediaImageProps {
  media: any;
  style?: any;
  expirySeconds?: number;
  priority?: boolean;
}

const MediaImageComponent = ({
  media,
  style = {},
  expirySeconds = 1800
}: MediaImageProps) => {
  const queryClient = useQueryClient();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
          onPressOut={() => setIsFullscreen(false)}
        >
          <MotiView
            from={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ width: windowWidth, height: windowHeight, justifyContent: 'center', alignItems: 'center' }}
          >
            <View style={{
              overflow: 'hidden',
              borderRadius: 20,
              width: windowWidth * 0.95,
              height: 'auto',
              maxHeight: windowHeight * 0.8,
              backgroundColor: '#fff'
            }}>
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
        onHandlerStateChange={evt => {
          if (evt.nativeEvent.state === GestureState.ACTIVE) setIsFullscreen(true);
        }}
      >
        <View style={{ flex: 1 }}>
          {!imageLoaded && (
            <View className="absolute top-0 left-0 right-0 bottom-0 bg-gray-200 flex-1 rounded-lg">
              <SkeletonElement width="100%" height="100%" radius={8} />
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