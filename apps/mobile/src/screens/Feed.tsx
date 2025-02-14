import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSessionStore } from '../stores/sessionStore';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '@env';
import { Platform } from 'react-native';
import { RootStackParamList } from '../types/navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function Feed() {
  const navigation = useNavigation<NavigationProp>();
  const { authUser, clearSession } = useSessionStore();
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const handleImageUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
        base64: Platform.OS === 'web',
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        let file;
        if (Platform.OS === 'web' && imageUri.startsWith('data:')) {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          file = new File([blob], 'upload.jpg', { type: 'image/jpeg' });
        } else {
          file = {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'upload.jpg',
          };
        }
        const formData = new FormData();
        formData.append('file', file as any);

        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) {
          throw new Error('No auth token available');
        }
        const response = await fetch(`${API_URL}/api/media`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
          },
        });
        
        const responseText = await response.text();
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse response:', e);
          throw new Error('Invalid server response');
        }

        if (!response.ok) {
          console.error('Upload failed with status:', response.status, 'Error:', data);
          throw new Error(data.error || 'Upload failed');
        }

        setUploadedUrl(data.media.url);
        Alert.alert('Success', 'File uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload error:', {
        message: error instanceof Error ? error.message : 'UnknownError',
        error
      });
      Alert.alert('Error', `Failed to upload image`);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      clearSession();
      // Remove navigation call - MainNavigator will handle this automatically
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!authUser?.id) {
                throw new Error('User ID not found');
              }

              const { error: authError } = await supabase.auth.admin.deleteUser(
                authUser.id
              );
              
              if (authError) throw authError;

              clearSession();
              navigation.navigate('Auth');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 p-5">
      <Text className="text-2xl font-bold mb-5">Welcome to Feed</Text>
      {authUser && (
        <View className="mt-5">
          <Text className="text-base mb-2.5">User ID: {authUser.id}</Text>
          <Text className="text-base mb-2.5">Email: {authUser.email}</Text>
        </View>
      )}

      <TouchableOpacity 
        className="bg-blue-600 p-3 rounded-lg mt-5 items-center"
        onPress={handleImageUpload}
      >
        <Text className="text-white text-base font-bold">Upload Image</Text>
      </TouchableOpacity>

      {uploadedUrl && (
        <View className="mt-5">
          <Text className="text-base mb-2.5">Uploaded Image:</Text>
          <Image 
            source={{ uri: uploadedUrl }} 
            className="w-full h-40 rounded-lg"
            resizeMode="cover"
          />
        </View>
      )}

      <TouchableOpacity 
        className="bg-red-600 p-3 rounded-lg mt-5 items-center"
        onPress={handleLogout}
      >
        <Text className="text-white text-base font-bold">Logout</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        className="bg-red-900 p-3 rounded-lg mt-2.5 items-center"
        onPress={handleDeleteAccount}
      >
        <Text className="text-white text-base font-bold">Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}