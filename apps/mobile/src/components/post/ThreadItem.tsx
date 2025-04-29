import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../Navigators/types/navigation';
import { ProfileImage } from '../media/ProfileImage';
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '../../atoms/commentAtoms';
import { useSavePost, useUnsavePost } from '../../hooks/useSavesPosts';
import { useAlert } from '../../lib/AlertContext';
import { useDeletePost } from '../../hooks/usePosts';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import { useAuthStore } from '../../stores/authStore';
import { useBlockUser } from '../../hooks/useBlocking';
import { PostMenu } from './PostMenu';
import FavoriteIcon from '../../../assets/icons/FavoriteIcon.svg';
import SavePostIcon from '../../../assets/icons/PlusIcon.svg';
import CommentIcon from '../../../assets/icons/CommentsIcon.svg';
import ShareIcon from '../../../assets/icons/PaperPlaneIcon.svg';
import SettingsIcon from '../../../assets/icons/MenuDots.svg';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface ThreadItemProps {
  thread: any;
  isLoading?: boolean;
}

export const ThreadItem = ({ thread, isLoading = false }: ThreadItemProps) => {
  const navigation = useNavigation<NavigationProp>();
  const formattedDate = new Date(thread.createdAt).toLocaleDateString();

  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();
  const deletePostMutation = useDeletePost();
  const { showAlert } = useAlert();
  const { user } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const blockUserMutation = useBlockUser(thread.user?.userId);
  const isOwnPost = thread.user?.userId === user?.id;

  const handleOpenComments = () => {
    setCurrentPostId(thread.id);
    setCommentDrawerOpen(true);
  };

  const handleToggleSavePost = async () => {
    try {
      if (thread.isSaved) {
        await unsavePostMutation.mutateAsync(thread.id);
      } else {
        await savePostMutation.mutateAsync(thread.id);
      }
    } catch (error: any) {
      console.error('Save/Unsave error:', error);
      showAlert(`Failed to ${thread.isSaved ? 'unsave' : 'save'} post`, { type: 'error' });
    }
  };

  const handleDeletePost = async () => {
    try {
      await deletePostMutation.mutateAsync(thread.id);
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

  return (
    <SkeletonLoader isLoading={isLoading}>
      <View className="bg-zinc-300 rounded-lg overflow-hidden mb-4 ">
        <View className="flex-row items-center p-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile', { userId: thread.userId })}
            className="w-12 h-12 mr-3 drop-shadow-md">
            {thread.user?.profileImage ? (
              <ProfileImage cloudflareId={thread.user.profileImage} style={{ borderRadius: 24 }} />
            ) : (
              <View className="w-10 h-10 bg-stone-300 rounded-full" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile', { userId: thread.userId })}>
            <Text className="text-black font-light text-xl">{thread.user?.username || 'User'}</Text>
          </TouchableOpacity>

          <View className="flex-1" />

          <TouchableOpacity
            className="w-6 h-6 justify-center items-center"
            onPress={() => setMenuVisible(true)}
          >
            <SettingsIcon width={24} height={24} />
          </TouchableOpacity>
        </View>

        <View className="p-3">
          <Text className="text-black text-base font-light leading-snug">
            {thread.content}
          </Text>
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

              <TouchableOpacity className="mr-10">
                <ShareIcon width={20} height={20} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleToggleSavePost}
              disabled={savePostMutation.isPending || unsavePostMutation.isPending}
            >
              {savePostMutation.isPending || unsavePostMutation.isPending ? (
                <ActivityIndicator size="small" color="#E4CAC7" />
              ) : thread.isSaved ? (
                <FavoriteIcon width={20} height={20} />
              ) : (
                <SavePostIcon width={20} height={20} />
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
        />
      </View>
    </SkeletonLoader>
  );
};
