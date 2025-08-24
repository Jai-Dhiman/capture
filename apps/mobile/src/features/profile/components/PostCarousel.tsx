import { PostItem } from '@/features/post/components/PostItem';
import type React from 'react';
import { useState } from 'react';
import {
  View,
  useWindowDimensions,
} from 'react-native';
import Carousel from 'react-native-reanimated-carousel';


interface PostReanimatedCarouselProps {
  posts: any[];
  initialIndex: number;
  carouselHeight?: number;
  itemSize?: number;
}

export const PostCarousel: React.FC<PostReanimatedCarouselProps> = ({
  posts,
  initialIndex,
  carouselHeight,
  itemSize,
}) => {
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const ITEM_WIDTH = width - 32;

  const renderItem = ({ item: post }: { item: any }) => {
    return (
      <View className="h-full mx-0">
        <PostItem post={post} />
      </View>
    );
  };

  return (
    <View className="flex-1 relative pt-0">
      <View className="flex-1" style={{ marginBottom: 40, marginTop: -15 }}>
        <Carousel
          loop={false}
          width={ITEM_WIDTH}
          height={carouselHeight || Math.min(height * 0.8, 600)}
          data={posts}
          renderItem={renderItem}
          defaultIndex={initialIndex}
          onSnapToItem={(index) => setActiveIndex(index)}
          mode="parallax"
          modeConfig={{
            parallaxScrollingScale: 0.94,
            parallaxScrollingOffset: 35,
          }}
          snapEnabled={true}
          overscrollEnabled={false}
          windowSize={1}
        />
      </View>

      <View
        className="w-full items-center justify-center bg-transparent"
        style={{
          position: 'absolute',
          bottom: -30,
          left: 0,
          right: 0,
          paddingBottom: 16,
          paddingTop: 12,
          height: 40,
        }}
      >
        <View className="flex-row justify-center">
          {posts.map((_, index) => (
            <View
              key={index}
              className={`mx-1 rounded-full ${index === activeIndex ? 'w-4 h-2 bg-[#E4CAC7]' : 'w-2 h-2 bg-gray-400'
                }`}
            />
          ))}
        </View>
      </View>
    </View>
  );
};
