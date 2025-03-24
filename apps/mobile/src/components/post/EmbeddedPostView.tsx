import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
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
  post: any;
  onClose: () => void;
}

export const EmbeddedPostView = ({ post, onClose }: EmbeddedPostViewProps) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const deletePostMutation = useDeletePost();
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();
  const { showAlert } = useAlert();
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  
  const formattedDate = new Date(post.createdAt).toLocaleDateString();
  
  const handleDeletePost = async () => {
    try {
      await deletePostMutation.mutateAsync(post.id);
      onClose();
    } catch (error: any) {
      console.error('Delete error:', error);
    }
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
  
  const handleOpenComments = () => {
    setCurrentPostId(post.id);
    setCommentDrawerOpen(true);
  };

  return (
    <View className="bg-zinc-300 rounded-lg overflow-hidden mb-4">
      <View className="flex-row justify-end items-center p-2">
        <TouchableOpacity 
          onPress={() => setIsMenuVisible(true)}
          className="w-6 h-6 justify-center items-center"
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
      
      <PostSettingsMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onDelete={handleDeletePost}
        isDeleting={deletePostMutation.isPending}
      />
    </View>
  );
};