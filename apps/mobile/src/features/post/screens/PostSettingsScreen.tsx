import { HashtagInput } from '@/features/hashtags/components/HashtagInput';
import { useUploadMedia } from '@/features/post/hooks/useMedia';
import { useCreatePost } from '@/features/post/hooks/usePosts';
import type { AppStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { useAlert } from '@/shared/lib/AlertContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  FlatList,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import DraggableFlatList from 'react-native-draggable-flatlist';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type PostSettingsScreenProps = NativeStackScreenProps<AppStackParamList, 'PostSettingsScreen'>;

interface SelectedPhoto {
  uri: string;
  type: string;
  name: string;
  order: number;
}

export default function PostSettingsScreen({ route }: PostSettingsScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const { selectedPhotos } = route.params;

  const [content, setContent] = useState('');
  const [selectedHashtags, setSelectedHashtags] = useState<Array<{ id: string; name: string }>>([]);
  const [aiLabelEnabled, setAiLabelEnabled] = useState(false);
  const [reorderedPhotos, setReorderedPhotos] = useState<SelectedPhoto[]>(selectedPhotos);

  const uploadMediaMutation = useUploadMedia();
  const createPostMutation = useCreatePost();
  const { showAlert } = useAlert();

  // Handle photo selection for editing
  const handlePhotoPress = (photo: SelectedPhoto) => {
    navigation.navigate('ImageEditScreen', { imageUri: photo.uri });
  };

  // Handle creating the post
  const handleCreatePost = async () => {
    if (reorderedPhotos.length === 0) {
      showAlert('No photos selected', { type: 'warning' });
      return;
    }

    try {
      // Upload media files (the hook expects an array)
      const filesForUpload = reorderedPhotos.map((photo, index) => ({
        uri: photo.uri,
        type: photo.type,
        name: photo.name,
        order: index,
      }));

      const uploadResults = await uploadMediaMutation.mutateAsync(filesForUpload);
      const mediaIds = uploadResults.map((result: any) => result.id);

      // Create the post
      const hashtagIds = selectedHashtags.map((hashtag) => hashtag.id);

      await createPostMutation.mutateAsync({
        content,
        type: 'post',
        mediaIds,
        hashtagIds,
      });

      showAlert('Post created successfully!', { type: 'success' });
      navigation.goBack();
      navigation.goBack(); // Go back to feed from NewPost
    } catch (error: any) {
      console.error('Post creation error:', {
        message: error.message,
        details: error.response?.errors || error,
      });
      showAlert(`Failed to create post: ${error.message}`, { type: 'error' });
    }
  };

  // Render photo preview item
  const renderPhotoPreview = ({ item, index, drag }: any) => (
    <TouchableOpacity
      onPress={() => handlePhotoPress(item)}
      onLongPress={drag}
      style={{
        width: 80,
        height: 80,
        marginRight: 8,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <Image
        source={{ uri: item.uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      {/* Order indicator */}
      <View
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>{index + 1}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-[#DCDCDE] rounded-[30px]">
      <Header height={120} showBackButton={true} onBackPress={() => navigation.goBack()} />

      <ScrollView className="flex-1 p-5">
        {/* Post Preview Section */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow">
          <Text className="text-lg font-bold mb-3">Post Preview</Text>

          {/* Photos Preview */}
          <DraggableFlatList
            data={reorderedPhotos}
            renderItem={renderPhotoPreview}
            keyExtractor={(item) => item.uri}
            onDragEnd={({ data }) => setReorderedPhotos(data)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          />

          <Text className="text-sm text-gray-500 mt-2">
            Tap to edit • Long press and drag to reorder
          </Text>
        </View>

        {/* Content Input Section */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow">
          <Text className="text-lg font-bold mb-3">Caption & Details</Text>

          {/* Caption Input */}
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-3 bg-gray-50"
            placeholder="Write a caption..."
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
            textAlignVertical="top"
            style={{ minHeight: 100 }}
          />
          <Text className="text-right text-gray-500 mb-3">{content.length}/500</Text>

          {/* Hashtags */}
          <HashtagInput
            selectedHashtags={selectedHashtags}
            onHashtagsChange={setSelectedHashtags}
            maxHashtags={5}
          />
        </View>

        {/* AI Label Toggle */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow">
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-lg font-bold">AI Label</Text>
              <Text className="text-gray-500 text-sm">Add AI-generated labels to your post</Text>
            </View>
            <Switch
              value={aiLabelEnabled}
              onValueChange={setAiLabelEnabled}
              trackColor={{ false: '#D1D5DB', true: '#A99CA3' }}
              thumbColor={aiLabelEnabled ? '#E4CAC7' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Settings Section */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow">
          <Text className="text-lg font-bold mb-3">Settings</Text>

          {/* Tag People */}
          <TouchableOpacity className="flex-row justify-between items-center py-3 border-b border-gray-200">
            <View>
              <Text className="font-medium">Tag People</Text>
              <Text className="text-gray-500 text-sm">Add people to your post</Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>

          {/* Add Location */}
          <TouchableOpacity className="flex-row justify-between items-center py-3 border-b border-gray-200">
            <View>
              <Text className="font-medium">Add Location</Text>
              <Text className="text-gray-500 text-sm">Share where this was taken</Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>

          {/* Commenting Preferences */}
          <TouchableOpacity className="flex-row justify-between items-center py-3 border-b border-gray-200">
            <View>
              <Text className="font-medium">Commenting Preferences</Text>
              <Text className="text-gray-500 text-sm">Control who can comment</Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>

          {/* Target Audience */}
          <TouchableOpacity className="flex-row justify-between items-center py-3">
            <View>
              <Text className="font-medium">Target Audience</Text>
              <Text className="text-gray-500 text-sm">Choose who can see this post</Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
        </View>

        {/* Post Button */}
        <TouchableOpacity
          className="bg-[#e4cac7] rounded-[30px] shadow px-6 py-4 mt-4"
          onPress={handleCreatePost}
          disabled={createPostMutation.isPending || uploadMediaMutation.isPending}
        >
          <Text className="text-black text-center font-bold text-lg">
            {createPostMutation.isPending || uploadMediaMutation.isPending ? 'Creating...' : 'Post'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
