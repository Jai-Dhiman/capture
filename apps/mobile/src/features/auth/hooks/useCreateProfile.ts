import { useProfileStore } from '@/features/profile/stores/profileStore';
import type { RootStackParamList } from '@/navigation/types';
import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { API_URL } from '@env';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export function useCreateProfile() {
  const { user, session, setStage } = useAuthStore();
  const { setProfile } = useProfileStore();
  const { showAlert } = useAlert();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const uploadImage = async (imageUri: string) => {
    if (!session?.access_token) throw new Error('No auth token available');

    try {
      const uploadUrlResponse = await fetch(`${API_URL}/api/media/image-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL } = await uploadUrlResponse.json();

      const formData = new FormData();

      if (imageUri.startsWith('data:')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('file', blob, 'profile.jpg');
      } else {
        formData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any);
      }

      const uploadResponse = await fetch(uploadURL, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const uploadResponseData = await uploadResponse.json();
      return uploadResponseData.result.id;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!session?.access_token) {
      throw new Error('No auth token available');
    }

    const url = `${API_URL}/api/profile/check-username?username=${username}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    return data.available;
  };

  return useMutation({
    mutationFn: async ({
      username,
      bio,
      profileImage,
    }: {
      username: string;
      bio?: string;
      profileImage?: string | null;
    }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      const isAvailable = await checkUsernameAvailability(username);

      if (!isAvailable) {
        throw new Error('Username already taken');
      }

      let cloudflareImageId = null;
      if (profileImage) {
        try {
          cloudflareImageId = await uploadImage(profileImage);
        } catch (error) {
          console.error('Image upload failed but continuing:', error);
        }
      }

      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          username,
          bio: bio?.trim() || null,
          profileImage: cloudflareImageId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create profile');
      }

      const result = await response.json();
      return result;
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create profile';

      let code = 'validation/error';
      if (errorMessage.includes('Username already taken')) {
        code = 'validation/username-taken';
      } else if (errorMessage.includes('Image upload failed')) {
        code = 'server/upload-failed';
      }

      const appError = errorService.createError(
        errorMessage,
        code,
        error instanceof Error ? error : undefined,
      );

      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },

    onSuccess: (profileData) => {
      setProfile({
        id: profileData.id,
        userId: profileData.userId,
        username: profileData.username,
        bio: profileData.bio || undefined,
        profileImage: profileData.profileImage || undefined,
      });

      setStage('authenticated');

      setTimeout(() => {
        navigation.navigate('App');
      }, 100);
    },
  });
}
