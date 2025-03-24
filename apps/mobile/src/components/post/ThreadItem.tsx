import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../Navigators/types/navigation';
import { ProfileImage } from '../media/ProfileImage';
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '../../atoms/commentAtoms';
import { useSavePost, useUnsavePost } from '../../hooks/useSavesPosts';
import { useAlert } from '../../lib/AlertContext';
import { useDeletePost } from '../../hooks/usePosts';
import { PostSettingsMenu } from './PostSettingsMenu';
import { HashtagDisplay } from '../hashtags/HashtagDisplay';
import FavoriteIcon from '../../../assets/icons/FavoriteIcon.svg';
import SavePostIcon from '../../../assets/icons/PlusIcon.svg';
import CommentIcon from '../../../assets/icons/CommentsIcon.svg';
import ShareIcon from '../../../assets/icons/PaperPlaneIcon.svg';
import SettingsIcon from '../../../assets/icons/MenuDots.svg';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface ThreadItemProps {
  thread: any;
}

export const ThreadItem = ({ thread }: ThreadItemProps) => {
  const navigation = useNavigation<NavigationProp>();
  const formattedDate = new Date(thread.createdAt).toLocaleDateString();
  const [settingsVisible, setSettingsVisible] = useState(false);
  
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();
  const deletePostMutation = useDeletePost();
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
    } catch (error: any) {
      console.error('Delete post error:', error);
      showAlert('Failed to delete post', { type: 'error' });
    }
  };
  
  return (
    <View className="bg-zinc-300 rounded-lg overflow-hidden mb-4">
    <View className="flex-row items-center p-3">
      <View className="w-10 h-10 mr-3">
        {thread.user?.profileImage ? (
          <ProfileImage cloudflareId={thread.user.profileImage} style={{ borderRadius: 20 }} />
        ) : (
          <View className="w-10 h-10 bg-stone-300 rounded-full" />
        )}
      </View>
      <Text className="text-black font-medium text-base">{thread.user?.username || 'User'}</Text>
      
      <View className="flex-1" />
      
      <TouchableOpacity 
        className="w-6 h-6 justify-center items-center"
        onPress={() => setSettingsVisible(true)}
      >
        <SettingsIcon width={24} height={24} />
      </TouchableOpacity>
    </View>
    
      <View className="mt-2 mb-6">
        <Text className="text-black text-base font-light leading-snug">
          {thread.content}
        </Text>
      </View>
      
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
      
      <PostSettingsMenu 
        isVisible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onDelete={handleDeletePost}
        isDeleting={deletePostMutation.isPending}
      />
    </View>
  );
};