import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { PostMediaGallery } from '../post/PostMediaGallery';
import SettingsIcon from "../../../assets/icons/MenuDots.svg";
import CommentIcon from "../../../assets/icons/CommentsIcon.svg";
import ShareIcon from "../../../assets/icons/PaperPlaneIcon.svg";
import SavePostIcon from "../../../assets/icons/PlusIcon.svg";
import FavoriteIcon from "../../../assets/icons/FavoriteIcon.svg";

interface PostReanimatedCarouselProps {
  posts: any[];
  initialIndex: number;
  onSettingsPress: (post: any) => void;
  onToggleSave: (post: any) => void;
  onOpenComments: (postId: string) => void;
  isSaving: boolean;
}

export const PostCarousel: React.FC<PostReanimatedCarouselProps> = ({
  posts,
  initialIndex,
  onSettingsPress,
  onToggleSave,
  onOpenComments,
  isSaving
}) => {
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const ITEM_WIDTH = width - 32;

  const calculateMediaHeight = () => {
    const headerHeight = 50;
    const footerHeight = 80;
    const paginationHeight = 20;
    const topMargin = 4;
    const bottomSafeArea = 40;

    const availableHeight = height * 0.68;
    return Math.min(
      availableHeight - headerHeight - footerHeight - paginationHeight - topMargin - bottomSafeArea,
      height * 0.525
    );
  };

  const mediaHeight = calculateMediaHeight();

  const renderItem = ({ item: post, index }: { item: any; index: number }) => {
    const formattedDate = new Date(post.createdAt).toLocaleDateString();

    return (
      <View className="bg-[#DCDCDE] rounded-lg overflow-hidden mb-2 h-full mx-0">
        <View className="flex-row justify-between items-center p-2">
          <View className="flex-1" />

          <TouchableOpacity
            onPress={() => onSettingsPress(post)}
            className="w-6 h-6 justify-center items-center"
          >
            <SettingsIcon width={24} height={24} />
          </TouchableOpacity>
        </View>

        <View style={{ width: '100%', height: mediaHeight }}>
          {post.media && post.media.length > 0 ? (
            <PostMediaGallery
              mediaItems={post.media}
              containerStyle={{ height: '100%' }}
            />
          ) : (
            <View className="w-full h-full bg-gray-200 justify-center items-center">
              <Text className="text-gray-500">Image Not Found</Text>
            </View>
          )}
        </View>

        <View className="p-4">
          <View className="flex-row justify-end mb-2">
            <Text className="text-center text-black text-[10px] font-light leading-3">
              {formattedDate}
            </Text>
          </View>

          <View className="flex-row justify-between items-center">
            <View className="flex-row">
              <TouchableOpacity onPress={() => onOpenComments(post.id)} className="mr-10">
                <CommentIcon width={20} height={20} />
              </TouchableOpacity>

              <TouchableOpacity className="mr-10">
                <ShareIcon width={20} height={20} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => onToggleSave(post)}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#E4CAC7" />
              ) : post.isSaved ? (
                <FavoriteIcon width={20} height={20} />
              ) : (
                <SavePostIcon width={20} height={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1">
      <Carousel
        loop={false}
        width={ITEM_WIDTH}
        height={height * 0.70}
        data={posts}
        renderItem={renderItem}
        defaultIndex={initialIndex}
        onSnapToItem={(index) => setActiveIndex(index)}
        mode="parallax"
        modeConfig={{
          parallaxScrollingScale: 0.92,
          parallaxScrollingOffset: 40,
        }}
        snapEnabled={true}
        overscrollEnabled={false}
        windowSize={1}
      />

      <View
        className="flex-row justify-center"
        style={{
          zIndex: 3,
          position: 'relative',
          bottom: 20,
        }}
      >
        {posts.map((_, index) => (
          <View
            key={index}
            className={`mx-1 rounded-full ${index === activeIndex
              ? 'w-4 h-2 bg-[#E4CAC7]'
              : 'w-2 h-2 bg-gray-400'
              }`}
          />
        ))}
      </View>
    </View>
  );
};