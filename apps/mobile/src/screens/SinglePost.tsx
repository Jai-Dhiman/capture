import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../components/Navigators/types/navigation';
import { Ionicons } from '@expo/vector-icons';
import SavedPostIcon from '../../assets/icons/FavoriteIcon.svg';
import SavePostIcon from '../../assets/icons/PlusIcon.svg';
import SettingsIcon from '../../assets/icons/SettingsIcon.svg';
import { ProfileImage } from '../components/media/ProfileImage';
import { PostMediaGallery } from '../components/post/PostMediaGallery';
import { HashtagDisplay } from '../components/hashtags/HashtagDisplay';
import { PostSettingsMenu } from '../components/post/PostSettingsMenu';
import { useSavePost, useUnsavePost } from '../hooks/useSavesPosts';
import { useDeletePost, useSinglePost } from '../hooks/usePosts';
import { useAuthStore } from '../stores/authStore';
import { useProfileStore } from '../stores/profileStore';
import { LoadingSpinner } from 'components/ui/LoadingSpinner';
import { useAlert } from '../lib/AlertContext';
import { useAtom } from 'jotai';
import { commentDrawerOpenAtom, currentPostIdAtom } from '../atoms/commentAtoms';
import { CommentDrawer } from '../components/comment/CommentDrawer';
import { useQueryClient } from '@tanstack/react-query';
import { commentLimitAtom, commentSortAtom } from '../atoms/commentAtoms';
import { useAtomValue } from 'jotai';
import Header from 'components/ui/Header'

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type SinglePostRouteProp = RouteProp<AppStackParamList, 'SinglePost'>;

export default function SinglePost() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SinglePostRouteProp>();
  const postId = route.params.post.id;
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const deletePostMutation = useDeletePost();
  const savePostMutation = useSavePost();
  const unsavePostMutation = useUnsavePost();
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  const { showAlert } = useAlert();
  const [, setCommentDrawerOpen] = useAtom(commentDrawerOpenAtom);
  const [, setCurrentPostId] = useAtom(currentPostIdAtom);
  const queryClient = useQueryClient();
  const defaultSort = useAtomValue(commentSortAtom);
  const defaultLimit = useAtomValue(commentLimitAtom);

  const { data: post, isLoading, error } = useSinglePost(postId);
  const isPostOwner = user?.id === post?.userId;

  if (isLoading) {
    return (
      <LoadingSpinner />
    );
  }
  
  if (error || !post) {
    return (
      <View className="flex-row items-center p-4 bg-transparent">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-[30px] font-light mx-auto">Post Not Found</Text>
        <View style={{ width: 24 }} />
      </View>
    );
  }

  const handleDeletePost = async () => {
    try {
      await deletePostMutation.mutateAsync(post.id);
      navigation.goBack();
    } catch (error: any) {
      console.error('Delete error:', error);
      console.log('Failed to delete post:', error.message);
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
    <View className="flex-1">
      <Image
        source={require('../../assets/DefaultBackground.png')}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
        resizeMode="cover"
      />
      
            
      <Header 
        showBackButton={true} 
        onBackPress={() => navigation.goBack()} 
      />
      
      <ScrollView className="flex-1">
        <View className="flex-row items-center p-3 border-b border-gray-100 bg-white">
          <View className="w-8 h-8 rounded-full overflow-hidden mr-2">
          {profile?.profileImage ? (
              <View className="w-full h-full rounded-full overflow-hidden">
                <ProfileImage cloudflareId={profile.profileImage} />
              </View>
            ) : (
              <View className="w-full h-full bg-gray-200" />
            )}
          </View>
          <Text className="font-medium">{post.user?.username || 'User'}</Text>
          
          {isPostOwner && (
            <TouchableOpacity 
              className="ml-auto"
              onPress={() => setIsMenuVisible(true)}
            >
              <SettingsIcon width={24} height={24} />
            </TouchableOpacity>
          )}
        </View>
        
        <View className="w-full bg-white">
          {post.media && post.media.length > 0 ? (
            <View className="h-[50vh]">
              <PostMediaGallery 
                mediaItems={post.media} 
                containerStyle={{ height: '100%' }} 
              />
            </View>
          ) : (
            <View className="h-[50vh] bg-gray-100 justify-center items-center">
              <Text className="text-gray-400">No image</Text>
            </View>
          )}
        </View>
      
        <View className="p-4 border-b border-gray-200 bg-white">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-4">
              <Text className="text-base">{post.content}</Text>
              
              {post.hashtags && post.hashtags.length > 0 ? (
                <HashtagDisplay hashtags={post.hashtags} size="medium" />
              ) : null}
            </View>
            
            <TouchableOpacity 
              onPress={handleOpenComments}
              className="flex-row items-center p-4"
            >
              <Ionicons name="chatbubble-outline" size={24} color="#333" />
              <Text className="ml-2 text-gray-700">
                {post._commentCount > 0 ? `${post._commentCount}` : "Comments"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleToggleSavePost}
              disabled={savePostMutation.isPending || unsavePostMutation.isPending}
            >
              {savePostMutation.isPending || unsavePostMutation.isPending ? (
                <ActivityIndicator size="small" color="#E4CAC7" />
              ) : post.isSaved ? (
                <SavedPostIcon width={24} height={24} />
              ) : (
                <SavePostIcon width={24} height={24} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <CommentDrawer />
      <PostSettingsMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onDelete={handleDeletePost}
        isDeleting={deletePostMutation.isPending}
      />
    </View>
  );
}