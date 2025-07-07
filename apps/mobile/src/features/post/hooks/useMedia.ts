import { useAuthStore } from '@/features/auth/stores/authStore';
import { API_URL } from '@env';
import { useMutation, useQuery } from '@tanstack/react-query';

export const useImageUrl = (mediaId?: string, variant = 'medium', format = 'webp') => {
  // Use long cache for CDN URLs
  const staleTime = 60 * 60 * 1000; // 1 hour

  return useQuery({
    queryKey: ['imageUrl', mediaId, variant, format],
    queryFn: async () => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      // Use CDN endpoint for optimized delivery
      const response = await fetch(`${API_URL}/api/media/cdn/${mediaId}?variant=${variant}&format=${format}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch image URL');
      }

      const data = await response.json();
      return data.url;
    },
    enabled: !!mediaId,
    staleTime: staleTime,
    gcTime: staleTime + 30 * 60 * 1000, // 30 min grace
  });
};

export const useUploadMedia = () => {
  return useMutation({
    mutationFn: async (files: Array<any>) => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      const uploads = files.map(async (file) => {
        try {
          const uploadUrlResponse = await fetch(`${API_URL}/api/media/image-upload`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contentType: file.type || 'image/jpeg',
              fileSize: file.size
            }),
          });

          if (!uploadUrlResponse.ok) {
            throw new Error('Failed to get upload URL');
          }

          const { uploadURL, id } = await uploadUrlResponse.json();

          // R2 expects direct file upload via PUT with binary data
          let fileData;
          if (file.uri.startsWith('data:')) {
            const response = await fetch(file.uri);
            fileData = await response.arrayBuffer();
          } else {
            // For React Native file URIs, we need to read the file
            const response = await fetch(file.uri);
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

export const useMediaSource = (mediaItem: any, variant = 'medium', format = 'webp') => {
  // For R2 system, always use media ID
  if (mediaItem?.id) {
    return useImageUrl(mediaItem.id, variant, format);
  }
  
  // Legacy support for storageKey or string IDs
  if (typeof mediaItem === 'string') {
    return useImageUrl(mediaItem, variant, format);
  }

  if (mediaItem?.storageKey) {
    // Extract ID from storageKey if needed
    const mediaId = mediaItem.storageKey.split('/').pop()?.split('_')[0];
    return useImageUrl(mediaId, variant, format);
  }

  return {
    data: null,
    isLoading: false,
    error: new Error('Invalid media source'),
    isStale: false,
  };
};
