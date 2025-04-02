import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '../../atoms/commentAtoms';
import { useSavePost, useUnsavePost } from '../../hooks/useSavesPosts';
import { useAlert } from '../../lib/AlertContext';
import { useDeletePost } from '../../hooks/usePosts';
import { useBlockUser } from '../../hooks/useBlocking'; 
import { useAuthStore } from '../../stores/authStore';  
import { PostMenu } from '../post/PostMenu';    
import FavoriteIcon from '../../../assets/icons/FavoriteIcon.svg';
import SavePostIcon from '../../../assets/icons/PlusIcon.svg';
import CommentIcon from '../../../assets/icons/CommentsIcon.svg';
import ShareIcon from '../../../assets/icons/PaperPlaneIcon.svg';
import SettingsIcon from '../../../assets/icons/MenuDots.svg';

interface ProfileThreadItemProps {
  thread: any;
  onSettingsPress?: (thread: any) => void;
}

export const ProfileThreadItem = memo(({ thread, onSettingsPress }: ProfileThreadItemProps) => {
  const formattedDate = new Date(thread.createdAt).toLocaleDateString();
  const [menuVisible, setMenuVisible] = useState(false);
  
  const { user } = useAuthStore();
  const isOwnPost = thread.user?.userId === user?.id; 
  
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();
  const deletePostMutation = useDeletePost();
  const blockUserMutation = useBlockUser(thread.user?.userId || ''); 
  const { showAlert } = useAlert();
  
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
      setMenuVisible(false); 
    } catch (error: any) {
      console.error('Delete post error:', error);
      showAlert('Failed to delete post', { type: 'error' });
    }
  };

  const handleBlockUser = async () => {
    try {
      await blockUserMutation.mutateAsync();
      showAlert('User blocked successfully', { type: 'success' });
      setMenuVisible(false);
    } catch (error: any) {
      console.error('Block user error:', error);
      showAlert('Failed to block user', { type: 'error' });
    }
  };
  

  const handleSettingsPress = () => {
    if (onSettingsPress) {
      onSettingsPress(thread);
    } else {
      setMenuVisible(true);
    }
  };
  
  return (
    <View className="bg-zinc-300 rounded-lg overflow-hidden mb-4">
      <View className="flex-row justify-end p-3">
        <TouchableOpacity 
          className="w-6 h-6 justify-center items-center"
          onPress={handleSettingsPress}
        >
          <SettingsIcon width={24} height={24} />
        </TouchableOpacity>
      </View>
    
      <View className="mx-4 mb-6">
        <Text className="text-black text-base font-light leading-snug">
          {thread.content}
        </Text>
      </View>
      
      <View className="flex-row justify-end mx-4 mb-2">
        <Text className="text-center text-black text-[10px] font-light leading-3">
          {formattedDate}
        </Text>
      </View>

      <View className="flex-row justify-between items-center px-4 pb-4">
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
      
      {!onSettingsPress && (
        <PostMenu 
          isVisible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onDeletePost={isOwnPost ? handleDeletePost : undefined}
          onBlockUser={!isOwnPost ? handleBlockUser : undefined}
          onReportPost={() => {
            showAlert('Post reported', { type: 'success' });
            setMenuVisible(false);
          }}
          onWhySeeing={() => {
            showAlert('This post appears in your feed because you follow this user', { type: 'info' });
            setMenuVisible(false);
          }}
          onEnableNotifications={() => {
            showAlert('Notifications enabled for this user', { type: 'success' });
            setMenuVisible(false);
          }}
          isOwnPost={isOwnPost}
          isLoading={isOwnPost ? deletePostMutation.isPending : blockUserMutation.isPending}
        />
      )}
    </View>
  );
});