import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Image, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { RootStackParamList } from 'types/navigation';
import { useUploadMedia } from 'hooks/useMedia';
import { useCreatePost } from 'hooks/usePosts';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NewPost() {
  const navigation = useNavigation<NavigationProp>();
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const uploadMediaMutation = useUploadMedia();
  const createPostMutation = useCreatePost();

  const handleImageSelection = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
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
      Alert.alert('Error', 'Failed to select images');
    }
  };

  const handleCreatePost = async () => {
    if (!content && selectedImages.length === 0) {
      Alert.alert('Error', 'Please add some content or images to your post');
      return;
    }

    try {
      const uploadedMedia = await uploadMediaMutation.mutateAsync(selectedImages);
      
      const mediaIds = uploadedMedia.map(media => media.id);
      await createPostMutation.mutateAsync({ content, mediaIds });
      
      Alert.alert('Success', 'Post created successfully!');
      navigation.goBack();
    } catch (error: any) {
      console.error('Post creation error:', {
        message: error.message,
        details: error.response?.errors || error
      });
      Alert.alert('Error', `Failed to create post: ${error.message}`);
    }
  };

  return (
    <View className="flex-1 p-5">
      <View className="flex-row items-center mb-5">
        <TouchableOpacity   
          className="p-2" 
          onPress={() => navigation.goBack()}
        >
        <Text className="text-blue-600 text-lg">← Back</Text>
        </TouchableOpacity>
      <Text className="text-2xl font-bold ml-2">Create New Post</Text>
    </View>
      <View className="mt-5 bg-white p-4 rounded-lg shadow">
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-3"
          placeholder="caption"
          value={content}
          onChangeText={setContent}
          multiline
        />

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

        <View className="flex-row justify-between">
          <TouchableOpacity
            className="bg-gray-200 p-3 rounded-lg flex-1 mr-2"
            onPress={handleImageSelection}
          >
            <Text className="text-center">Add Images</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-blue-600 p-3 rounded-lg flex-1 ml-2"
            onPress={handleCreatePost}
            disabled={createPostMutation.isPending || uploadMediaMutation.isPending}
          >
            <Text className="text-white text-center">
              {createPostMutation.isPending ? 'Creating...' : 'Create Post'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}