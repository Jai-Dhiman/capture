import React, { useState, useRef, memo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PostMediaGallery } from '../post/PostMediaGallery';
import { PostSettingsMenu } from '../post/PostSettingsMenu';
import { useDeletePost } from '../../hooks/usePosts';
import { useSavePost, useUnsavePost } from '../../hooks/useSavesPosts';
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '../../atoms/commentAtoms';
import { useAlert } from '../../lib/AlertContext';
import FavoriteIcon from '../../../assets/icons/FavoriteIcon.svg';
import SavePostIcon from '../../../assets/icons/PlusIcon.svg';
import CommentIcon from '../../../assets/icons/CommentsIcon.svg';
import ShareIcon from '../../../assets/icons/PaperPlaneIcon.svg';
import SettingsIcon from '../../../assets/icons/MenuDots.svg';

interface EmbeddedPostViewProps {
  posts: any[];
  initialPostIndex: number;
  onClose: () => void;
}

export const EmbeddedPostView = memo(({ posts, initialPostIndex, onClose }: EmbeddedPostViewProps) => {
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialPostIndex);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const flashListRef = useRef<FlashList<any>>(null);
  
  const deletePostMutation = useDeletePost();
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();
  const { showAlert } = useAlert();
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  
  const currentPost = posts[currentIndex];
  
  const calculateMediaHeight = useCallback(() => {
    const isSmallScreen = width < 375;
    const mediaHeightPercentage = isSmallScreen ? 0.35 : 0.42;
    return Math.round(height * mediaHeightPercentage);
  }, [width, height]);
  
  const mediaHeight = calculateMediaHeight();
  
  useEffect(() => {
    if (flashListRef.current && initialPostIndex >= 0) {
      setTimeout(() => {
        flashListRef.current?.scrollToIndex({
          index: initialPostIndex,
          animated: false
        });
      }, 100);
    }
  }, [initialPostIndex]);
  
  const handleDeletePost = async () => {
    try {
      await deletePostMutation.mutateAsync(currentPost.id);
      onClose();
    } catch (error: any) {
      console.error('Delete error:', error);
    }
  };
  
  const handleToggleSavePost = async () => {
    try {
      if (currentPost.isSaved) {
        await unsavePostMutation.mutateAsync(currentPost.id);
      } else {
        await savePostMutation.mutateAsync(currentPost.id);
      }
    } catch (error: any) {
      console.error('Save/Unsave error:', error);
      showAlert(`Failed to ${currentPost.isSaved ? 'unsave' : 'save'} post`, { type: 'error' });
    }
  };
  
  const handleOpenComments = () => {
    setCurrentPostId(currentPost.id);
    setCommentDrawerOpen(true);
  };

  const renderPost = ({ item: post }: { item: any }) => {
    const formattedDate = new Date(post.createdAt).toLocaleDateString();
    
    const containerWidth = width;
    
    return (
      <View style={{ width: containerWidth, padding: 12 }}>
        <View className="bg-zinc-300 rounded-lg overflow-hidden mb-4">
          <View className="flex-row justify-between items-center p-2">
            <View className="flex-1" />
            
            <TouchableOpacity 
              onPress={() => setIsMenuVisible(true)}
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
              <View className="flex-row space-x-8">
                <TouchableOpacity onPress={handleOpenComments}>
                  <CommentIcon width={20} height={20} />
                </TouchableOpacity>
                
                <TouchableOpacity>
                  <ShareIcon width={20} height={20} />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                onPress={handleToggleSavePost}
                disabled={savePostMutation.isPending || unsavePostMutation.isPending}
              >
                {savePostMutation.isPending || unsavePostMutation.isPending ? (
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
      </View>
    );
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const viewSize = event.nativeEvent.layoutMeasurement;
    const newIndex = Math.round(contentOffset.x / viewSize.width);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < posts.length) {
      setCurrentIndex(newIndex);
    }
  };

  const scrollToIndex = (index: number) => {
    if (index >= 0 && index < posts.length) {
      flashListRef.current?.scrollToIndex({ index, animated: true });
      setCurrentIndex(index);
    }
  };

  return (
    <View className="flex-1">
      <FlashList
        ref={flashListRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        estimatedItemSize={mediaHeight + 150}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialScrollIndex={initialPostIndex}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 48 : 24 }}
        snapToInterval={width}
        decelerationRate="fast"
      />
      
      {posts.length > 1 && (
        <View className="h-8 absolute bottom-4 left-0 right-0 flex-row justify-center items-center">
          <View className="bg-stone-300 bg-opacity-80 px-3 py-2 rounded-full flex-row">
            {posts.map((_, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={() => scrollToIndex(index)}
                className="mx-1"
              >
                <View 
                  className={`h-2 rounded-full ${
                    index === currentIndex ? 'w-4 bg-[#E4CAC7]' : 'w-2 bg-gray-400'
                  }`} 
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      
      <PostSettingsMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onDelete={handleDeletePost}
        isDeleting={deletePostMutation.isPending}
      />
    </View>
  );
});