import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSessionStore } from '../../stores/sessionStore'
import * as ImagePicker from 'expo-image-picker'
import { useCreateProfile } from '../../hooks/auth/useCreateProfile'
import { LoadingSpinner } from 'components/LoadingSpinner'

export default function CreateProfile() {
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const navigation = useNavigation()
  const { authUser } = useSessionStore()
  const createProfileMutation = useCreateProfile()
  
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to grant camera roll permissions to upload a photo.')
      return
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    
    if (!result.canceled) {
      setProfileImage(result.assets[0].uri)
    }
  }
  
  const createProfile = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required')
      return
    }
    
    createProfileMutation.mutate(
      {
        username: username.trim(),
        bio: bio.trim() || undefined,
        profileImage
      },
      {
        onSuccess: () => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'App' as never }]
          })
        },
        onError: (error) => {
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Failed to create profile'
            
          Alert.alert('Error', errorMessage)
        }
      }
    )
  }

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
          disabled={createProfileMutation.isPending}
        >
          {createProfileMutation.isPending ? (
            <LoadingSpinner fullScreen message="Creating your profile..." />
          ) : (
            <Text className="text-base font-bold font-roboto text-center">
              Create Profile
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
          