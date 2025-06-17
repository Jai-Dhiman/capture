import { HashtagInput } from '@/features/hashtags/components/HashtagInput';
import { useUploadMedia } from '@/features/post/hooks/useMedia';
import { useCreatePost } from '@/features/post/hooks/usePosts';
import type { RootStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { useAlert } from '@/shared/lib/AlertContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect } from 'react';
import {
  GestureResponderEvent,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Platform } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';

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
  const { width } = useWindowDimensions();
  const [spacing, setSpacing] = useState(8);

  useEffect(() => {
    const calculatedSpacing = width * 0.02;
    setSpacing(Math.max(8, Math.min(16, calculatedSpacing)));
  }, [width]);

  const imageCount = selectedImages.length;
  const numColumns = imageCount <= 3 ? imageCount : 2;

  // Image selection logic
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
        setSelectedImages((prevImages) => [...prevImages, ...formattedImages]);
      }
    } catch (error) {
      console.error('Selection error:', error);
      showAlert('Failed to select images', { type: 'error' });
    }
  };

  // Remove image
  const handleRemoveImage = (index: number) => {
    setSelectedImages((images) => images.filter((_, i) => i !== index));
  };

  // Navigate to image edit screen
  const handleImagePress = (image: any) => {
    navigation.navigate('ImageEditScreen', { imageUri: image.uri });
  };

  // Post creation logic
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
        mediaIds = uploadedMedia.map((media) => media.id);
      }
      const hashtagIds = selectedHashtags.map((hashtag) => hashtag.id);

      await createPostMutation.mutateAsync({
        content,
        type: postType,
        mediaIds,
        hashtagIds,
      });

      showAlert(`${postType === 'post' ? 'Post' : 'Thread'} created successfully!`, {
        type: 'success',
      });
      navigation.goBack();
    } catch (error: any) {
      console.error('Post creation error:', {
        message: error.message,
        details: error.response?.errors || error,
      });
      showAlert(`Failed to create post: ${error.message}`, { type: 'error' });
    }
  };

  // Render each image in the draggable list
  const renderImageItem = ({ item, index, drag, isActive }: any) => (
    <Pressable
      onPress={() => handleImagePress(item)}
      onLongPress={drag}
      style={{ flex: 1, aspectRatio: 1, margin: spacing / 2, opacity: isActive ? 0.8 : 1 }}
    >
      <Image
        source={{ uri: item.uri }}
        className="w-full h-full rounded-lg border border-black"
        resizeMode="cover"
      />
      <Pressable
        onPress={() => handleRemoveImage(index)}
        style={{
          position: 'absolute',
          top: spacing / 4,
          right: spacing / 4,
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: 12,
          padding: 4,
          zIndex: 2,
        }}
      >
        <Text className="text-white text-xs font-bold">×</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-[#DCDCDE] rounded-[30px]">
      <Header height={120} showBackButton={true} onBackPress={() => navigation.goBack()} />

      <ScrollView className="flex-1">
        <View className="flex-1 p-5">
          {/* Type Selector */}
          <View className="w-full h-10 mb-5 rounded-lg flex-row justify-center items-center overflow-hidden bg-white/10 shadow">
            <TouchableOpacity
              className={`flex-1 mx-1 h-8 rounded-md flex justify-center items-center ${postType === 'post' ? 'bg-[#a99ca3]' : 'bg-[#dcdcde]'}`}
              onPress={() => setPostType('post')}
            >
              <Text
                className={`text-center text-xs ${postType === 'post' ? 'text-white font-semibold' : 'text-black font-normal'}`}
              >
                Photo/Video
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 mx-1 h-8 rounded-md flex justify-center items-center ${postType === 'thread' ? 'bg-[#a99ca3]' : 'bg-[#dcdcde]'}`}
              onPress={() => setPostType('thread')}
            >
              <Text
                className={`text-center text-xs ${postType === 'thread' ? 'text-white font-semibold' : 'text-black font-normal'}`}
              >
                Thread
              </Text>
            </TouchableOpacity>
          </View>

          {/* Image Grid for photo/video */}
          {postType === 'post' && selectedImages.length > 0 && (
            <View style={{ paddingHorizontal: spacing, marginBottom: spacing }}>
              <DraggableFlatList
                data={selectedImages}
                onDragEnd={({ data }) => setSelectedImages(data)}
                keyExtractor={(item) => item.uri}
                renderItem={renderImageItem}
                numColumns={numColumns}
                scrollEnabled={false}
                nestedScrollEnabled={true}
                activationDistance={10}
                contentContainerStyle={{}}
                columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: spacing }}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}

          {/* Content Input */}
          <View className="mt-2 bg-[#dcdcde] p-4 rounded-lg shadow">
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3 bg-[#dcdcde]"
              placeholder={postType === 'post' ? 'Write a caption...' : "What's on your mind?"}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={postType === 'post' ? 500 : 800}
            />
            <Text className="text-right text-gray-500 mb-2">
              {content.length}/{postType === 'post' ? 500 : 800}
            </Text>

            {/* Hashtags */}
            <HashtagInput
              selectedHashtags={selectedHashtags}
              onHashtagsChange={setSelectedHashtags}
              maxHashtags={5}
            />

            {/* Add Images Button (only for posts) */}
            {postType === 'post' && (
              <TouchableOpacity
                className="bg-[#a99ca3] rounded-[30px] shadow px-6 py-3 mb-2 mt-2"
                onPress={handleImageSelection}
              >
                <Text className="text-center text-white font-bold text-base">Add Images</Text>
              </TouchableOpacity>
            )}

            {/* Post Button */}
            <TouchableOpacity
              className="bg-[#e4cac7] rounded-[30px] shadow px-6 py-3 mt-2"
              onPress={handleCreatePost}
              disabled={createPostMutation.isPending || uploadMediaMutation.isPending}
            >
              <Text className="text-black text-center font-bold text-base">
                {createPostMutation.isPending ? 'Creating...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
