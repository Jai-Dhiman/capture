import React, { useState } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { PostMediaGallery } from './PostMediaGallery';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../Navigators/types/navigation';
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

interface PostItemProps {
  post: any;
  isLoading?: boolean;
}

export const PostItem = ({ post, isLoading = false }: PostItemProps) => {
  const navigation = useNavigation<NavigationProp>();
  const isThread = post.type === 'thread';
  const formattedDate = new Date(post.createdAt).toLocaleDateString();
  
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();
  const deletePostMutation = useDeletePost();
  const { showAlert } = useAlert();
  const { user } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const blockUserMutation = useBlockUser(post.user?.userId);
  const isOwnPost = post.user?.userId === user?.id;
  
  const handleOpenComments = () => {
    setCurrentPostId(post.id);
    setCommentDrawerOpen(true);
  };
  
  const handleToggleSavePost = async () => {
    try {
      if (post.isSaved) {
        await unsavePostMutation.mutateAsync(post.id);
      } else {
        await savePostMutation.mutateAsync(post.id);
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

  return (
    <SkeletonLoader isLoading={isLoading}>
      <View className="bg-zinc-300 rounded-lg overflow-hidden mb-4">
        <View className="flex-row items-center p-3">
          <View className="w-10 h-10 mr-3">
            {post.user?.profileImage ? (
              <ProfileImage cloudflareId={post.user.profileImage} style={{ borderRadius: 20 }} />
            ) : (
              <View className="w-10 h-10 bg-stone-300 rounded-full" />
            )}
          </View>
          <Text className="text-black font-medium text-base">{post.user?.username || 'User'}</Text>
          
          <View className="flex-1" />
          
          <TouchableOpacity 
            className="w-6 h-6 justify-center items-center"
            onPress={() => setMenuVisible(true)}
          >
            <SettingsIcon width={24} height={24} />
          </TouchableOpacity>
         </View>
        
        <View className="w-full h-[350px]">
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
          {/* {post.content && (
            <Text className="text-base mb-2">{post.content}</Text>
          )} */}
        
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
        <PostMenu
          isVisible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onDeletePost={isOwnPost ? handleDeletePost : undefined}
          onBlockUser={!isOwnPost ? handleBlockUser : undefined}
          onReportPost={() => {/* Handle report */}}
          onWhySeeing={() => {/* Handle why */}}
          onEnableNotifications={() => {/* Handle notifications */}}
          isOwnPost={isOwnPost}
          isLoading={isOwnPost ? deletePostMutation?.isPending : blockUserMutation.isPending}
        />
      </View>
    </SkeletonLoader>

    
  );
};