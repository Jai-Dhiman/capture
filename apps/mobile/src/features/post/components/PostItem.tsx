import React, { useState } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator, Share, Alert, type GestureResponderEvent } from 'react-native';
import { PostMediaGallery } from './PostMediaGallery';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '@navigation/types';
import { ProfileImage } from './ProfileImage';
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '@features/comments/atoms/commentAtoms';
import { useSavePost, useUnsavePost } from '../hooks/useSavesPosts';
import { useAlert } from '@shared/lib/AlertContext';
import { useDeletePost } from '../hooks/usePosts';
import { SkeletonLoader } from '@shared/components/SkeletonLoader';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useBlockUser } from '@features/profile/hooks/useBlocking';
import { PostMenu } from './PostMenu';
import FavoriteIcon from '@assets/icons/FavoriteIcon.svg';
import FilledFavoriteIcon from '@assets/icons/FilledFavoriteIcon.svg';
import CommentIcon from '@assets/icons/CommentsIcon.svg';
import ShareIcon from '@assets/icons/PaperPlaneIcon.svg';
import SettingsIcon from '@assets/icons/MenuDots.svg';
import Clipboard from 'expo-clipboard';
import { SHARE_URL } from '@env';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface PostItemProps {
  post: any;
  isLoading?: boolean;
}

type MenuPosition = {
  x: number;
  y: number;
} | undefined;

export const PostItem = ({ post: initialPost, isLoading = false }: PostItemProps) => {
  const navigation = useNavigation<NavigationProp>();
  const formattedDate = new Date(initialPost.createdAt).toLocaleDateString();
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();
  const deletePostMutation = useDeletePost();
  const { showAlert } = useAlert();
  const { user } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>(undefined);
  const blockUserMutation = useBlockUser(initialPost.userId);
  const isOwnPost = initialPost.userId === user?.id;
  const [post, setPost] = useState(initialPost);

  const handleOpenComments = () => {
    setCurrentPostId(post.id);
    setCommentDrawerOpen(true);
  };

  const handleToggleSavePost = async () => {
    try {
      if (post.isSaved) {
        await unsavePostMutation.mutateAsync(post.id);
        setPost((prev: typeof initialPost) => ({ ...prev, isSaved: false }));
      } else {
        await savePostMutation.mutateAsync(post.id);
        setPost((prev: typeof initialPost) => ({ ...prev, isSaved: true }));
      }
    } catch (error: any) {
      console.error('Save/Unsave error:', error);
      showAlert(`Failed to ${post.isSaved ? 'unsave' : 'save'} post`, { type: 'error' });
    }
  };

  const handleDeletePost = async () => {
    try {
      await deletePostMutation.mutateAsync(post.id);
      showAlert('Post deleted successfully', { type: 'success' });
    } catch (error: any) {
      console.error('Delete post error:', error);
      showAlert('Failed to delete post', { type: 'error' });
    }
  };

  const handleBlockUser = async () => {
    try {
      await blockUserMutation.mutateAsync();
      showAlert('User blocked successfully', { type: 'success' });
    } catch (error: any) {
      console.error('Block user error:', error);
      showAlert('Failed to block user', { type: 'error' });
    }
  };

  const handleShare = async () => {
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

  const handleOpenMenu = (event: GestureResponderEvent) => {
    const { nativeEvent } = event;
    setMenuPosition({
      x: nativeEvent.pageX,
      y: nativeEvent.pageY - 10
    });
    setMenuVisible(true);
  };

  return (
    <SkeletonLoader isLoading={isLoading}>
      <View className="bg-[#DCDCDE] rounded-lg overflow-hidden mb-4">
        <View className="flex-row items-center p-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile', { userId: post.userId })}
            className="w-12 h-12 mr-3 drop-shadow-md">
            {post.user?.profileImage ? (
              <ProfileImage cloudflareId={post.user.profileImage} style={{ borderRadius: 24 }} />
            ) : (
              <View className="w-10 h-10 bg-stone-300 rounded-full" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile', { userId: post.userId })}>
            <Text className="text-black font-light text-xl">{post.user?.username || 'User'}</Text>
          </TouchableOpacity>

          <View className="flex-1" />

          <TouchableOpacity
            className="w-6 h-6 justify-center items-center"
            onPress={handleOpenMenu}
          >
            <SettingsIcon width={24} height={24} />
          </TouchableOpacity>
        </View>

        <View className="w-full h-[300px]">
          {post.media && post.media.length > 0 ? (
            <PostMediaGallery
              mediaItems={post.media}
              containerStyle={{ height: '100%' }}
            />
          ) : (
            <View className="w-full h-full bg-gray-200 justify-center items-center">
              <Text className="text-gray-500">No image</Text>
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
              <TouchableOpacity onPress={handleOpenComments} className="mr-4">
                <CommentIcon width={20} height={20} />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleShare} className="mr-10">
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
                <FilledFavoriteIcon width={20} height={20} />
              ) : (
                <FavoriteIcon width={20} height={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <PostMenu
          isVisible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onDeletePost={isOwnPost ? handleDeletePost : undefined}
          onBlockUser={!isOwnPost ? handleBlockUser : undefined}
          onReportPost={() => {/* Handle report */ }}
          onWhySeeing={() => {/* Handle why */ }}
          onEnableNotifications={() => {/* Handle notifications */ }}
          isOwnPost={isOwnPost}
          isLoading={isOwnPost ? deletePostMutation?.isPending : blockUserMutation.isPending}
          buttonPosition={menuPosition}
        />
      </View>
    </SkeletonLoader>
  );
};