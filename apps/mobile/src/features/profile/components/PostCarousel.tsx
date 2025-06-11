import type React from 'react';
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions, Share, Alert } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { PostMediaGallery } from '@/features/post/components/PostMediaGallery';
import SettingsIcon from "@assets/icons/MenuDots.svg";
import CommentIcon from "@assets/icons/CommentsIcon.svg";
import ShareIcon from "@assets/icons/PaperPlaneIcon.svg";
import FavoriteIcon from "@assets/icons/FavoriteIcon.svg";
import FilledFavoriteIcon from "@assets/icons/FilledFavoriteIcon.svg";
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '@/features/comments/atoms/commentAtoms';
import Clipboard from 'expo-clipboard';
import { SHARE_URL } from '@env';
import { useAlert } from '@/shared/lib/AlertContext';

interface PostReanimatedCarouselProps {
  posts: any[];
  initialIndex: number;
  onSettingsPress: (post: any) => void;
  onToggleSave: (post: any) => void;
  onOpenComments?: (postId: string) => void;
  isSaving: boolean;
}

export const PostCarousel: React.FC<PostReanimatedCarouselProps> = ({
  posts: initialPosts,
  initialIndex,
  onSettingsPress,
  onToggleSave,
  isSaving
}) => {
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [posts, setPosts] = useState(initialPosts);
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const { showAlert } = useAlert();

  const ITEM_WIDTH = width - 32;

  const calculateMediaHeight = () => {
    const headerHeight = 50;
    const footerHeight = 80;
    const paginationHeight = 30;
    const topMargin = 0;
    const bottomSafeArea = 40;

    const availableHeight = Math.min(height * 0.65, 580);

    const adaptiveRatio = height > 800 ? 0.55 : 0.5;

    return Math.min(
      availableHeight - headerHeight - footerHeight - paginationHeight - topMargin - bottomSafeArea,
      height * adaptiveRatio
    );
  };

  const mediaHeight = calculateMediaHeight();

  const handleOpenComments = (postId: string) => {
    setCurrentPostId(postId);
    setCommentDrawerOpen(true);
  };

  const handleShare = async (post: any) => {
    const link = `${SHARE_URL}/post/${post.id}`;
    try {
      const result = await Share.share({ message: `${post.content ?? ''}\n\nView more: ${link}` });
      if (result.action === Share.sharedAction) {
        // TODO: track share analytics
      }
    } catch (_error) {
      await Clipboard.setStringAsync(link);
      Alert.alert('Link copied to clipboard');
    }
  };

  const handleToggleSavePost = async (post: any) => {
    try {
      setSavingPostId(post.id);
      // Immediately update UI
      const updatedPosts = posts.map(p =>
        p.id === post.id ? { ...p, isSaved: !p.isSaved } : p
      );
      setPosts(updatedPosts);

      // Call the parent handler
      onToggleSave(post);
    } catch (error: any) {
      // Revert UI if there was an error
      const revertedPosts = posts.map(p =>
        p.id === post.id ? { ...p, isSaved: !p.isSaved } : p
      );
      setPosts(revertedPosts);
      console.error('Save/Unsave error:', error);
      showAlert(`Failed to ${post.isSaved ? 'unsave' : 'save'} post`, { type: 'error' });
    } finally {
      setSavingPostId(null);
    }
  };

  const renderItem = ({ item: post }: { item: any }) => {
    const formattedDate = new Date(post.createdAt).toLocaleDateString();
    const isCurrentPostSaving = savingPostId === post.id;

    return (
      <View className="bg-[#DCDCDE] rounded-lg overflow-hidden mb-0 h-full mx-0">
        <View className="flex-row justify-between items-center p-1 pt-0 pb-2">
          <View className="flex-1" />

          <TouchableOpacity
            onPress={() => onSettingsPress(post)}
            className="w-8 h-8 justify-center items-center"
          >
            <SettingsIcon width={24} height={24} />
          </TouchableOpacity>
        </View>

        <View style={{ width: '100%', height: mediaHeight, marginTop: -12 }}>
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

        <View className="p-3">
          <View className="flex-row justify-end mb-1">
            <Text className="text-center text-black text-[10px] font-light leading-3">
              {formattedDate}
            </Text>
          </View>

          <View className="flex-row justify-between items-center">
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => handleOpenComments(post.id)}
                className="mr-4 p-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <CommentIcon width={20} height={20} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleShare(post)}
                className="mr-4 p-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ShareIcon width={20} height={20} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => handleToggleSavePost(post)}
              disabled={isCurrentPostSaving || isSaving}
              className="p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isCurrentPostSaving || isSaving ? (
                <ActivityIndicator size="small" color="#E4CAC7" />
              ) : post.isSaved ? (
                <FilledFavoriteIcon width={20} height={20} />
              ) : (
                <FavoriteIcon width={20} height={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 relative pt-0">
      <View className="flex-1" style={{ marginBottom: 40, marginTop: -15 }}>
        <Carousel
          loop={false}
          width={ITEM_WIDTH}
          height={Math.min(height * (height <= 812 ? 0.55 : 0.67), height <= 812 ? 430 : 600)}
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
          height: 40
        }}
      >
        <View className="flex-row justify-center">
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
    </View>
  );
};