import { useAuthStore } from '@/features/auth/stores/authStore';
import { API_URL } from '@/shared/config/env';
import { getCDNImageUrl, getImageUrl } from '@/shared/lib/apiClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { useMemo } from 'react';

interface UploadFile {
  uri: string;
  type: string;
  name: string;
  order: number;
  size?: number;
}

// Helper function to convert ph:// URLs to local file URIs
const convertPhotoLibraryUri = async (uri: string): Promise<{ uri: string; size: number }> => {
  if (!uri.startsWith('ph://')) {
    // For non-ph:// URIs (including edited images from cache), get file info
    console.log('📸 Using direct URI (may be edited):', uri);
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return {
      uri,
      size: (fileInfo as any).size || 0,
    };
  }

  try {
    // Extract the asset ID from the ph:// URI
    const assetId = uri.replace('ph://', '').split('/')[0];

    // Get asset info from MediaLibrary
    const asset = await MediaLibrary.getAssetInfoAsync(assetId);
    const sourceUri = asset.localUri || asset.uri;

    // Convert to JPEG using ImageManipulator for consistent format
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      sourceUri,
      [], // No transformations, just format conversion
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      },
    );

    // Get file size
    const fileInfo = await FileSystem.getInfoAsync(manipulatedImage.uri);

    return {
      uri: manipulatedImage.uri,
      size: (fileInfo as any).size || 0,
    };
  } catch (error) {
    console.error('Failed to convert photo library URI:', error);
    throw new Error('Failed to convert photo from library');
  }
};

export const useImageUrl = (
  media: { id: string; storageKey?: string } | null,
  variant: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'medium',
  useCDN = true,
) => {
  return useQuery({
    queryKey: ['imageUrl', media?.id, variant, useCDN],
    queryFn: async () => {
      if (!media?.id) throw new Error('No media ID provided');

      if (useCDN) {
        const url = await getCDNImageUrl(media.id, variant);
        // Return null if the image is missing (e.g., seed images that don't exist)
        return url;
      }
      return await getImageUrl(media.id);
    },
    enabled: !!media?.id,
    staleTime: 5 * 60 * 1000, // URLs are valid for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

export const useImageUrls = (
  mediaList: Array<{ id: string; storageKey?: string; order?: number }> = [],
  variant: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'medium',
  useCDN = true,
) => {
  return useQuery({
    queryKey: ['imageUrls', mediaList.map((m) => m.id), variant, useCDN],
    queryFn: async () => {
      const urlPromises = mediaList
        .sort((a, b) => (a.order || 0) - (b.order || 0)) // Sort by order
        .map(async (media) => {
          try {
            let url: string | null;
            if (useCDN) {
              url = await getCDNImageUrl(media.id, variant);
            } else {
              url = await getImageUrl(media.id);
            }
            return { ...media, url };
          } catch (error) {
            console.error(`Failed to get URL for media ${media.id}:`, error);
            return { ...media, url: null, error: true };
          }
        });

      return await Promise.all(urlPromises);
    },
    enabled: mediaList.length > 0,
    staleTime: 5 * 60 * 1000, // URLs are valid for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

export const useUploadMedia = () => {
  return useMutation({
    mutationFn: async (files: UploadFile[]) => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      const uploads = files.map(async (file: UploadFile) => {
        try {
          // Convert ph:// URLs to local file URIs and get correct file size
          const { uri: convertedUri, size: fileSize } = await convertPhotoLibraryUri(file.uri);

          const uploadUrlResponse = await fetch(`${API_URL}/api/media/image-upload`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contentType: file.type || 'image/jpeg',
              fileSize,
            }),
          });

          if (!uploadUrlResponse.ok) {
            throw new Error('Failed to get upload URL');
          }

          const { uploadURL, id } = await uploadUrlResponse.json();

          // R2 expects direct file upload via PUT with binary data
          let fileData: ArrayBuffer;
          if (convertedUri.startsWith('data:')) {
            const response = await fetch(convertedUri);
            fileData = await response.arrayBuffer();
          } else {
            // For local file URIs, read the file using fetch
            const response = await fetch(convertedUri);
            fileData = await response.arrayBuffer();
          }

          const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: fileData,
            headers: {
              'Content-Type': file.type || 'image/jpeg',
            },
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image to R2');
          }

          const createRecordResponse = await fetch(`${API_URL}/api/media/image-record`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageId: id, // Use the R2 ID instead of Cloudflare ID
              order: file.order,
            }),
          });

          if (!createRecordResponse.ok) {
            throw new Error('Failed to create media record');
          }

          const { media } = await createRecordResponse.json();
          return media;
        } catch (error) {
          console.error('Upload error:', error);
          throw error;
        }
      });

      return Promise.all(uploads);
    },
  });
};

export const useCloudflareImageUrl = (cloudflareId?: string, expirySeconds = 1800) => {
  const staleTime = Math.min(expirySeconds * 1000 * 0.8, 20 * 60 * 1000);

  return useQuery({
    queryKey: ['cloudflareImageUrl', cloudflareId, expirySeconds],
    queryFn: async () => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(
        `${API_URL}/api/media/cloudflare-url/${cloudflareId}?expiry=${expirySeconds}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch image URL');
      }

      const data = await response.json();
      return data.url;
    },
    enabled: !!cloudflareId,
    staleTime: staleTime,
    gcTime: staleTime + 5 * 60 * 1000,
  });
};

export const useMediaSource = (
  mediaItem: any,
  variant: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'medium',
) => {
  const normalizedMedia = useMemo(() => {
    if (mediaItem?.id) return { id: mediaItem.id };
    if (typeof mediaItem === 'string') return { id: mediaItem };
    if (mediaItem?.storageKey) {
      if (mediaItem.storageKey.includes('seed-images/')) return { id: mediaItem.storageKey };
      const mediaId = mediaItem.storageKey.split('/').pop()?.split('_')[0];
      return { id: mediaId || mediaItem.storageKey };
    }
    return null;
  }, [mediaItem]);

  return useImageUrl(normalizedMedia, variant, true);
};

export const useDeleteMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mediaId: string) => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error('Failed to delete media');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedMedia'] });
    },
    onError: (error) => {
      console.error('Delete media failed:', error.message);
    },
  });
};

export const useRestoreMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mediaId: string) => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/media/restore/${mediaId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error('Failed to restore media');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedMedia'] });
    },
    onError: (error) => {
      console.error('Restore media failed:', error.message);
    },
  });
};

export const useDeletedMedia = (limit = 50, offset = 0) => {
  return useQuery({
    queryKey: ['deletedMedia', limit, offset],
    queryFn: async () => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/media/deleted?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch deleted media');
      return response.json();
    },
  });
};

export const useBatchUpload = () => {
  return useMutation({
    mutationFn: async ({ count, contentType }: { count: number; contentType?: string }) => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/media/batch-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ count, contentType }),
      });

      if (!response.ok) throw new Error('Failed to get batch upload URLs');
      return response.json();
    },
    onError: (error) => {
      console.error('Batch upload failed:', error.message);
    },
  });
};
