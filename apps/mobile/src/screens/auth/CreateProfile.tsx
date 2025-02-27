import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../stores/sessionStore';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '@env';

export default function CreateProfile() {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { authUser, setUserProfile } = useSessionStore();
  
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to grant camera roll permissions to upload a photo.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (token: string, imageUri: string) => {
    try {
      const uploadUrlResponse = await fetch(`${API_URL}/api/media/image-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL, id: imageId } = await uploadUrlResponse.json();

      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile-image.jpg',
      } as any);

      const uploadResponse = await fetch(uploadURL, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image to Cloudflare');
      }

      const uploadResponseData = await uploadResponse.json();
      const cloudflareImageId = uploadResponseData.result.id;

      const createRecordResponse = await fetch(`${API_URL}/api/media/image-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageId: cloudflareImageId,
          order: 0,
        }),
      });

      if (!createRecordResponse.ok) {
        throw new Error('Failed to create media record');
      }

      const { media } = await createRecordResponse.json();
      return media.storageKey;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };
  
  const createProfile = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No auth token available');
      }
      
      const checkResponse = await fetch(`${API_URL}/api/profile/check-username?username=${username}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const checkData = await checkResponse.json();
      
      if (!checkData.available) {
        Alert.alert('Username Taken', 'Please choose a different username');
        setLoading(false);
        return;
      }
      
      let storageKey = null;
      if (profileImage) {
        try {
          storageKey = await uploadImage(token, profileImage);
        } catch (error) {
          console.error('Image upload error:', error);
          Alert.alert(
            'Image Upload Failed',
            'We couldn\'t upload your profile photo, but you can continue creating your profile.'
          );
        }
      }
      
      const profileResponse = await fetch(`${API_URL}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: authUser?.id,
          username,
          bio: bio.trim() || null,
          profileImage: storageKey
        })
      });
      
      if (!profileResponse.ok) {
        const errorData = await profileResponse.json();
        throw new Error(errorData.message || 'Failed to create profile');
      }
      
      const profileData = await profileResponse.json();
      
      setUserProfile({
        id: profileData.id,
        supabase_id: authUser?.id || '',
        username: profileData.username,
        bio: profileData.bio || undefined,
        image: profileData.profileImage || undefined
      });
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'App' as never }]
      });
    } catch (error) {
      console.error('Error creating profile:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden p-6">
        <Text className="text-[32px] font-roboto text-center mt-8 mb-8">
          Create Your Profile
        </Text>
        
        <TouchableOpacity 
          className="w-32 h-32 rounded-full bg-gray-200 mx-auto mb-8 items-center justify-center overflow-hidden"
          onPress={pickImage}
        >
          {profileImage ? (
            <Image source={{ uri: profileImage }} className="w-full h-full" />
          ) : (
            <View className="items-center justify-center">
              <Text className="text-gray-500 text-center">Add Photo</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <View className="mb-6">
          <Text className="text-base font-roboto mb-2">Username *</Text>
          <TextInput
            className="bg-white h-[56px] rounded-[16px] shadow-md px-4 text-base font-roboto"
            value={username}
            onChangeText={setUsername}
            placeholder="Choose a unique username"
            autoCapitalize="none"
          />
        </View>
        
        <View className="mb-8">
          <Text className="text-base font-roboto mb-2">Bio (Optional)</Text>
          <TextInput
            className="bg-white rounded-[16px] shadow-md p-4 text-base font-roboto min-h-[100px]"
            value={bio}
            onChangeText={setBio}
            placeholder="Create a Bio..."
            multiline
            textAlignVertical="top"
          />
        </View>
        
        <TouchableOpacity
          className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-4"
          onPress={createProfile}
          disabled={loading}
        >
          <Text className="text-base font-bold font-roboto text-center">
            {loading ? 'Creating Profile...' : 'Complete Profile'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}