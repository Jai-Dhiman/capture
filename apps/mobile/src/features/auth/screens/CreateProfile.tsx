import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useForm } from '@tanstack/react-form';
import { LoadingSpinner } from '@shared/components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { useCreateProfile } from '../hooks/useCreateProfile';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useAlert } from '@shared/lib/AlertContext';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export default function CreateProfile() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isBioFocused, setIsBioFocused] = useState(false);
  const { showAlert } = useAlert();

  const { logout } = useAuth();
  const { completeStep } = useOnboardingStore();
  const createProfileMutation = useCreateProfile();

  const usernameInputRef = useRef<TextInput>(null);
  const bioInputRef = useRef<TextInput>(null);

  const USERNAME_MAX_LENGTH = 20;
  const BIO_MAX_LENGTH = 50;

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      showAlert('Permission Required, You need to grant camera roll permissions to upload a photo.');
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

  const form = useForm({
    defaultValues: {
      username: '',
      bio: ''
    },
    onSubmit: async ({ value }) => {
      if (!value.username.trim()) {
        showAlert('Username is required', { type: 'warning' });
        return;
      }

      createProfileMutation.mutate(
        {
          username: value.username.trim(),
          bio: value.bio.trim() || undefined,
          profileImage
        },
        {
          onSuccess: () => {
            showAlert('Profile created successfully!', { type: 'success', duration: 3000 });
            completeStep('profile-setup');
            navigation.navigate('App');
          },
          onError: (error) => {
            const errorMessage = error instanceof Error
              ? error.message
              : 'Failed to create profile';

            showAlert(errorMessage, { type: 'error' });
          }
        }
      );
    }
  });

  const handleLogout = () => {
    logout.mutate();
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

        <form.Field
          name="username"
          validators={{
            onChange: ({ value }) => {
              if (!value.trim()) return 'Username is required';
              if (value.length < 3) return 'Username must be at least 3 characters';
              if (value.length > USERNAME_MAX_LENGTH) return `Username must be ${USERNAME_MAX_LENGTH} characters or less`;
              if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores';
              return undefined;
            }
          }}
        >
          {(field) => (
            <View className="mb-6">
              <Text className="text-base font-roboto mb-2">Username *</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => usernameInputRef.current?.focus()}
                className={`bg-white h-[56px] rounded-[16px] shadow-md px-4 text-base font-roboto ${isUsernameFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
              >
                <TextInput
                  ref={usernameInputRef}
                  onFocus={() => setIsUsernameFocused(true)}
                  onBlur={() => {
                    setIsUsernameFocused(false);
                    field.handleBlur();
                  }}
                  className="flex-1 h-full"
                  value={field.state.value}
                  onChangeText={(text) => {
                    if (text.length <= USERNAME_MAX_LENGTH) {
                      field.handleChange(text);
                    }
                  }}
                  placeholder="Choose a unique username"
                  autoCapitalize="none"
                  maxLength={USERNAME_MAX_LENGTH}
                />
              </TouchableOpacity>
              <View className="flex-row justify-end">
                <Text className={`text-xs mt-1 ${field.state.value.length >= USERNAME_MAX_LENGTH ? 'text-red-500' : 'text-gray-500'}`}>
                  {field.state.value.length}/{USERNAME_MAX_LENGTH}
                </Text>
              </View>
              {field.state.meta.errors.length > 0 && (
                <Text className="text-red-500 text-xs mt-1">
                  {field.state.meta.errors.join(', ')}
                </Text>
              )}
            </View>
          )}
        </form.Field>

        <form.Field
          name="bio"
          validators={{
            onChange: ({ value }) => {
              if (value.length > BIO_MAX_LENGTH) return `Bio must be ${BIO_MAX_LENGTH} characters or less`;
              return undefined;
            }
          }}
        >
          {(field) => (
            <View className="mb-8">
              <Text className="text-base font-roboto mb-2">Bio (Optional)</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => bioInputRef.current?.focus()}
                className={`bg-white rounded-[16px] shadow-md p-4 text-base font-roboto min-h-[100px] ${isBioFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
              >
                <TextInput
                  ref={bioInputRef}
                  onFocus={() => setIsBioFocused(true)}
                  onBlur={() => {
                    setIsBioFocused(false);
                    field.handleBlur();
                  }}
                  className="flex-1"
                  value={field.state.value}
                  onChangeText={(text) => {
                    if (text.length <= BIO_MAX_LENGTH) {
                      field.handleChange(text);
                    }
                  }}
                  placeholder="Create a Bio..."
                  multiline
                  textAlignVertical="top"
                  maxLength={BIO_MAX_LENGTH}
                />
              </TouchableOpacity>
              <View className="flex-row justify-end">
                <Text className={`text-xs mt-1 ${field.state.value.length >= BIO_MAX_LENGTH ? 'text-red-500' : 'text-gray-500'}`}>
                  {field.state.value.length}/{BIO_MAX_LENGTH}
                </Text>
              </View>
              {field.state.meta.errors.length > 0 && (
                <Text className="text-red-500 text-xs mt-1">
                  {field.state.meta.errors.join(', ')}
                </Text>
              )}
            </View>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <TouchableOpacity
              className={`bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-4 items-center ${!canSubmit ? 'opacity-70' : ''}`}
              onPress={() => form.handleSubmit()}
              disabled={createProfileMutation.isPending || isSubmitting}
            >
              {createProfileMutation.isPending || isSubmitting ? (
                <LoadingSpinner />
              ) : (
                <Text className="text-base font-bold font-roboto text-center">
                  Create Profile
                </Text>
              )}
            </TouchableOpacity>
          )}
        </form.Subscribe>

        <TouchableOpacity
          className="mt-6 items-center"
          onPress={handleLogout}
          disabled={logout.isPending}
        >
          <Text className="text-blue-600 underline text-base">
            {logout.isPending ? 'Logging out...' : 'Log out'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}