import { useAuthStore } from '@/features/auth/stores/authStore';
import { API_URL } from '@env';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { getImageUrl, getCDNImageUrl } from '@/shared/lib/apiClient';

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
    // For non-ph:// URIs, get file info
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
  useCDN = true
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
  useCDN = true
) => {
  return useQuery({
    queryKey: ['imageUrls', mediaList.map(m => m.id), variant, useCDN],
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
  variant: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'medium'
) => {
  // For R2 system, always use media ID
  if (mediaItem?.id) {
    return useImageUrl(mediaItem, variant, true);
  }
  
  // Legacy support for storageKey or string IDs
  if (typeof mediaItem === 'string') {
    return useImageUrl({ id: mediaItem }, variant, true);
  }

  if (mediaItem?.storageKey) {
    // Extract ID from storageKey if needed
    const mediaId = mediaItem.storageKey.split('/').pop()?.split('_')[0];
    return useImageUrl({ id: mediaId || mediaItem.storageKey }, variant, true);
  }

  return {
    data: null,
    isLoading: false,
    error: null, // Changed from Error object to null for consistency
    isStale: false,
  };
};
