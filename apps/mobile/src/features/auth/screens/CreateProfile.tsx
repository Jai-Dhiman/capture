import type { RootStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useAlert } from '@/shared/lib/AlertContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useRef } from 'react';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useCreateProfile } from '../hooks/useCreateProfile';

export default function CreateProfile() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isBioFocused, setIsBioFocused] = useState(false);
  const { showAlert } = useAlert();

  const { logout } = useAuth();
  const createProfileMutation = useCreateProfile();

  const usernameInputRef = useRef<TextInput>(null);
  const bioInputRef = useRef<TextInput>(null);

  const USERNAME_MAX_LENGTH = 20;
  const BIO_MAX_LENGTH = 50;

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      showAlert(
        'Permission Required, You need to grant camera roll permissions to upload a photo.',
      );
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
      bio: '',
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
          profileImage,
        },
        {
          onSuccess: () => {
            showAlert('Profile created successfully!', { type: 'success', duration: 3000 });
            navigation.navigate('App', { screen: 'Feed' });
          },
          onError: (error) => {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to create profile';

            showAlert(errorMessage, { type: 'error' });
          },
        },
      );
    },
  });

  const handleBackPress = () => {
    Alert.alert(
      'Are you sure?',
      'You will be logged out and returned to the login screen.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          onPress: () => {
            logout.mutate(undefined, {
              onSuccess: () => {
              },
            });
          },
          style: 'destructive',
        },
      ],
      { cancelable: false },
    );
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
          <Image
            source={require('@assets/DefaultBackground.png')}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            resizeMode="cover"
          />

          <Header showBackButton={true} onBackPress={handleBackPress} />

          <View className="w-full h-full absolute top-0 left-0 bg-zinc-300/60" />

          <View className="flex-row items-start mt-6 px-[22px] mb-4">
            <TouchableOpacity
              className="w-20 h-20 rounded-full bg-gray-200 items-center justify-center overflow-hidden shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] mr-[18px]"
              onPress={pickImage}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} className="w-full h-full" />
              ) : (
                <View className="items-center justify-center">
                  <Text className="text-gray-500 text-center font-roboto text-xs">Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {profileImage && (
              <Text className="w-5 h-2.5 absolute left-[44px] top-[215px] text-center justify-start text-blue-700 text-xs font-normal font-roboto leading-3">
                Edit
              </Text>
            )}

            <View className="flex-1 mt-[8px]">
              <Text className="text-black text-sm font-semibold font-roboto leading-none mb-1">
                Create Your @username
              </Text>
              <form.Field
                name="username"
                validators={{
                  onChange: ({ value }) => {
                    if (!value.trim()) {
                      return 'Username is required';
                    }
                    if (value.length < 3) {
                      return 'Username must be at least 3 characters';
                    }
                    if (value.length > USERNAME_MAX_LENGTH) {
                      return `Username must be ${USERNAME_MAX_LENGTH} characters or less`;
                    }
                    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                      return 'Username can only contain letters, numbers, and underscores';
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <View className="mb-2">
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => usernameInputRef.current?.focus()}
                      className={`bg-transparent h-[48px] rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] px-4 text-base font-roboto outline outline-1 outline-offset-[-1px] outline-black ${isUsernameFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                    >
                      <TextInput
                        ref={usernameInputRef}
                        onFocus={() => setIsUsernameFocused(true)}
                        onBlur={() => {
                          setIsUsernameFocused(false);
                          field.handleBlur();
                        }}
                        className="flex-1 h-full text-black font-semibold font-roboto"
                        value={field.state.value}
                        onChangeText={(text) => {
                          if (text.length <= USERNAME_MAX_LENGTH) {
                            field.handleChange(text);
                          }
                        }}
                        placeholder="@JohnDoe"
                        placeholderTextColor="#A0A0A0"
                        autoCapitalize="none"
                        maxLength={USERNAME_MAX_LENGTH}
                      />
                    </TouchableOpacity>
                    <View className="flex-row justify-end">
                      <Text
                        className={`text-xs mt-1 font-roboto ${field.state.value.length >= USERNAME_MAX_LENGTH ? 'text-red-500' : 'text-black/60 font-light'}`}
                      >
                        {field.state.value.length}/{USERNAME_MAX_LENGTH}
                      </Text>
                    </View>
                    {field.state.meta.errors.length > 0 && (
                      <Text className="text-red-500 text-xs mt-1 font-roboto">
                        {field.state.meta.errors.join(', ')}
                      </Text>
                    )}
                  </View>
                )}
              </form.Field>
            </View>
          </View>

          <View className="px-[26px] mt-4 mb-3">
            <form.Field
              name="bio"
              validators={{
                onChange: ({ value }) => {
                  if (value.length > BIO_MAX_LENGTH)
                    return `Bio must be ${BIO_MAX_LENGTH} characters or less`;
                  return undefined;
                },
              }}
            >
              {(field) => (
                <View className="mb-2">
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => bioInputRef.current?.focus()}
                    className={`bg-transparent rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-4 text-base font-roboto min-h-[128px] outline outline-1 outline-offset-[-1px] outline-black ${isBioFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                  >
                    <TextInput
                      ref={bioInputRef}
                      onFocus={() => setIsBioFocused(true)}
                      onBlur={() => {
                        setIsBioFocused(false);
                        field.handleBlur();
                      }}
                      className="flex-1 text-black font-semibold font-roboto"
                      value={field.state.value}
                      onChangeText={(text) => {
                        if (text.length <= BIO_MAX_LENGTH) {
                          field.handleChange(text);
                        }
                      }}
                      placeholder="Create a Bio..."
                      placeholderTextColor="#A0A0A0"
                      multiline
                      textAlignVertical="top"
                      maxLength={BIO_MAX_LENGTH}
                    />
                  </TouchableOpacity>
                  <View className="flex-row justify-end">
                    <Text
                      className={`text-xs mt-1 font-roboto ${field.state.value.length >= BIO_MAX_LENGTH ? 'text-red-500' : 'text-black/60 font-light'}`}
                    >
                      {field.state.value.length}/{BIO_MAX_LENGTH}
                    </Text>
                  </View>
                  {field.state.meta.errors.length > 0 && (
                    <Text className="text-red-500 text-xs mt-1 font-roboto">
                      {field.state.meta.errors.join(', ')}
                    </Text>
                  )}
                </View>
              )}
            </form.Field>
          </View>

          <View className="px-[18px] mt-0">
            <Text className="justify-start text-black text-xs font-bold font-roboto leading-3">
              Profile Background Design
            </Text>
            <Text className="justify-start text-black text-[10px] font-light font-roboto leading-3 mt-2">
              Give your profile a pop of color and a personal flair by selecting the design people
              will see when visiting your profile.{' '}
            </Text>

            <View className="flex-row mt-4">
              <View className="w-16 h-6 bg-stone-300 rounded-[30px] border border-black items-center justify-center mr-4">
                <Text className="text-center justify-start text-black text-xs font-normal font-roboto leading-3">
                  Fluid
                </Text>
              </View>
              <View className="w-16 h-6 bg-stone-300/0 rounded-[30px] border border-black items-center justify-center mr-4">
                <Text className="text-center justify-start text-black text-xs font-normal font-roboto leading-3">
                  Splatter
                </Text>
              </View>
              <View className="w-16 h-6 bg-stone-300/0 rounded-[30px] border border-black items-center justify-center">
                <Text className="text-center justify-start text-black text-xs font-normal font-roboto leading-3">
                  Smokey
                </Text>
              </View>
            </View>

            <View className="flex-row mt-6">
              <View className="w-32 h-60 rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] outline outline-1 outline-offset-[-1px] outline-black/10 mr-4">
                <Image
                  className="w-32 h-60 rounded-[10px]"
                  source={{ uri: 'https://placehold.co/124x236' }}
                />
              </View>
              <View className="w-32 h-60 rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] outline outline-1 outline-offset-[-1px] outline-black/10 mr-4">
                <Image
                  className="w-32 h-60 rounded-[10px]"
                  source={{ uri: 'https://placehold.co/124x236' }}
                />
              </View>
              <View className="w-32 h-60 rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] outline outline-1 outline-offset-[-1px] outline-black/10">
                <Image
                  className="w-32 h-60 rounded-[10px]"
                  source={{ uri: 'https://placehold.co/124x236' }}
                />
              </View>
            </View>
          </View>

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => {
              return (
                <TouchableOpacity
                  className={`bg-stone-300 h-[56px] rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] justify-center mt-8 items-center backdrop-blur-[2px] mx-[26px] ${!canSubmit ? 'opacity-70' : ''}`}
                  onPress={() => {
                    form.handleSubmit();
                  }}
                  disabled={createProfileMutation.isPending || isSubmitting}
                >
                  {createProfileMutation.isPending || isSubmitting ? (
                    <LoadingSpinner />
                  ) : (
                    <Text className="text-base font-bold font-roboto text-center text-black">
                      Create Profile
                    </Text>
                  )}
                </TouchableOpacity>
              );
            }}
          </form.Subscribe>

          <View className="h-5 left-0 bottom-0 w-full items-center justify-center">
            <View className="w-36 h-[5px] bg-black rounded-[100px]" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
