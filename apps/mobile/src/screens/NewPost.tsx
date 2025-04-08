import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { RootStackParamList } from 'components/Navigators/types/navigation';
import { useUploadMedia } from 'hooks/useMedia';
import { useCreatePost } from 'hooks/usePosts';
import { HashtagInput } from '../components/hashtags/HashtagInput';
import { useAlert } from '../lib/AlertContext';
import Header from '../components/ui/Header'
import { PhoneVerificationCheck } from '../lib/PhoneVerificationCheck';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PostType = 'post' | 'thread';

export default function NewPost() {
  const navigation = useNavigation<NavigationProp>();
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [selectedHashtags, setSelectedHashtags] = useState<Array<{ id: string; name: string }>>([]);
  const [postType, setPostType] = useState<PostType>('post');
  const uploadMediaMutation = useUploadMedia();
  const createPostMutation = useCreatePost();
  const { showAlert } = useAlert();

  const handleImageSelection = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert('Please allow access to your photos', { type: 'warning' });
        return;
      }
  
      const remainingSlots = 4 - selectedImages.length;
      
      if (remainingSlots <= 0) {
        showAlert('Maximum of 4 images allowed per post', { type: 'warning' });
        return;
      }
  
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
        base64: Platform.OS === 'web',
      });
  
      if (!result.canceled && result.assets.length > 0) {
        const formattedImages = result.assets.map((asset, index) => ({
          uri: asset.uri,
          type: 'image/jpeg',
          name: `upload-${Date.now()}-${index}.jpg`,
          order: selectedImages.length + index,
        }));
        setSelectedImages(prevImages => [...prevImages, ...formattedImages]);
      }
    } catch (error) {
      console.error('Selection error:', error);
      showAlert('Failed to select images', { type: 'error' });
    }
  };

  const handleCreatePost = async () => {
    if (!content && selectedImages.length === 0 && postType === 'post') {
      showAlert('Please add some content or images to your post', { type: 'warning' });
      return;
    }
    
    if (!content && postType === 'thread') {
      showAlert('Please add some content to your thread', { type: 'warning' });
      return;
    }

    try {
      let mediaIds: string[] = [];
      
      if (postType === 'post' && selectedImages.length > 0) {
        const uploadedMedia = await uploadMediaMutation.mutateAsync(selectedImages);
        mediaIds = uploadedMedia.map(media => media.id);
      }
      
      const hashtagIds = selectedHashtags.map(hashtag => hashtag.id);
      
      const createdPost = await createPostMutation.mutateAsync({ 
        content, 
        type: postType,
        mediaIds,
        hashtagIds
      });
      
      showAlert(`${postType === 'post' ? 'Post' : 'Thread'} created successfully!`, { type: 'success' });
      navigation.goBack();
    } catch (error: any) {
      console.error('Post creation error:', {
        message: error.message,
        details: error.response?.errors || error
      });
      showAlert(`Failed to create post: ${error.message}`, { type: 'error' });
    }
  };

  return (
    <PhoneVerificationCheck
      message="To create posts and share content, please verify your phone number first. This helps keep our community safe."
    >
    <ScrollView className="flex-1">
      <View className="flex-1 p-5">
        <Header 
          showBackButton={true} 
          onBackPress={() => navigation.goBack()} 
        />
        
        {/* Type Selector */}
        <View className="w-full h-10 p-9 mb-5 shadow rounded-lg flex-row justify-center items-center overflow-hidden">
          <TouchableOpacity 
            className={`flex-1 mx-1 h-8 rounded-md flex justify-center items-center ${postType === 'post' ? 'bg-stone-400' : 'bg-gray-100'}`}
            onPress={() => setPostType('post')}
          >
            <Text className={`text-center text-xs ${postType === 'post' ? 'text-white font-semibold' : 'text-black font-normal'}`}>
              Photo/Video
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 mx-1 h-8 rounded-md flex justify-center items-center ${postType === 'thread' ? 'bg-stone-400' : 'bg-gray-100'}`}
            onPress={() => setPostType('thread')}
          >
            <Text className={`text-center text-xs ${postType === 'thread' ? 'text-white font-semibold' : 'text-black font-normal'}`}>
              Thread
            </Text>
          </TouchableOpacity>
        </View>
        
        <View className="mt-5 bg-white p-4 rounded-lg shadow">
          {/* Content Input */}
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-3"
            placeholder={postType === 'post' ? "Write a caption..." : "What's on your mind?"}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={postType === 'post' ? 500 : 800}
          />
          
          {/* Character Count */}
          <Text className="text-right text-gray-500 mb-2">
            {content.length}/{postType === 'post' ? 500 : 800}
          </Text>

          {/* Hashtags */}
          <HashtagInput
            selectedHashtags={selectedHashtags}
            onHashtagsChange={setSelectedHashtags}
            maxHashtags={5}
          />

          {/* Media Upload (only for posts) */}
          {postType === 'post' && (
            <>
              <View className="flex-row flex-wrap mb-3">
                {selectedImages.map((image, index) => (
                  <View key={index} className="w-20 h-20 m-1 bg-gray-200 rounded">
                    <Image
                      source={{ uri: image.uri }}
                      className="w-full h-full rounded"
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </View>

              <TouchableOpacity
                className="bg-gray-200 p-3 rounded-lg mb-3"
                onPress={handleImageSelection}
              >
                <Text className="text-center">Add Images</Text>
              </TouchableOpacity>
            </>
          )}
          
          {/* Submit Button */}
          <TouchableOpacity
            className="bg-[#E4CAC7] p-3 rounded-lg"
            onPress={handleCreatePost}
            disabled={createPostMutation.isPending || uploadMediaMutation.isPending}
          >
            <Text className="text-black text-center font-bold">
              {createPostMutation.isPending ? 'Creating...' : `Create ${postType === 'post' ? 'Post' : 'Thread'}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
    </PhoneVerificationCheck>
  );
}