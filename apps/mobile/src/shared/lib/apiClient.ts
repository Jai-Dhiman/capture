import { useAuthStore } from '@/features/auth/stores/authStore';
import Constants from 'expo-constants';

// Get API URL from EAS config or fallback
const API_URL =
  Constants.expoConfig?.extra?.API_URL ||
  process.env.API_URL ||
  'https://capture-api.jai-d.workers.dev';

class APIError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

export const apiClient = {
  async get(endpoint: string, requiresAuth = true) {
    return this.request('GET', endpoint, null, requiresAuth);
  },

  async post(endpoint: string, data: any, requiresAuth = true) {
    return this.request('POST', endpoint, data, requiresAuth);
  },

  async put(endpoint: string, data: any, requiresAuth = true) {
    return this.request('PUT', endpoint, data, requiresAuth);
  },

  async delete(endpoint: string, requiresAuth = true) {
    return this.request('DELETE', endpoint, null, requiresAuth);
  },

  async request<T = any>(
    method: string,
    endpoint: string,
    data: any = null,
    requiresAuth = true,
    retryCount = 0,
  ): Promise<T> {
    try {
      const { session, refreshSession } = useAuthStore.getState();

      let token = session?.access_token;

      // If auth is required but no token is available
      if (requiresAuth && !token) {
        // If this is the first attempt, wait briefly and retry once
        if (retryCount < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** retryCount));
          return this.request(method, endpoint, data, requiresAuth, retryCount + 1);
        }
        throw new APIError('No authentication token available', 401);
      }

      // Check if token needs refresh (expires within 5 minutes)
      if (requiresAuth && token && session?.expires_at) {
        const isExpiringSoon = session.expires_at - Date.now() < 5 * 60 * 1000;
        if (isExpiringSoon) {
          const refreshedSession = await refreshSession();
          token = refreshedSession?.access_token;
          if (!token && retryCount < 2) {
            await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** retryCount));
            return this.request(method, endpoint, data, requiresAuth, retryCount + 1);
          }
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const options: RequestInit = {
        method,
        headers,
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const fullUrl = `${API_URL}${endpoint}`;

      const response = await fetch(fullUrl, options);

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
        }

        const errorMessage =
          errorData.error || errorData.message || `Request failed with status ${response.status}`;
        console.error(`API Error (${response.status}):`, errorMessage);

        throw new APIError(errorMessage, response.status);
      }

      if (response.status === 204) {
        return null as T;
      }

      const result = await response.json();
      return result;
    } catch (error) {
      if (error instanceof APIError) {
        console.error(`API Error: ${error.message} (${error.statusCode})`);
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Network request failed';
      console.error(`Network Error: ${message}`);
      throw new APIError(message);
    }
  },
};

/**
 * Generate image URL from media ID using the media API
 * @param mediaId - The media ID
 * @param expirySeconds - URL expiry time in seconds (default: 30 minutes)
 * @returns Promise with the image URL
 */
export const getImageUrl = async (mediaId: string, expirySeconds = 1800) => {
  try {
    const response = await apiClient.get(`/api/media/${mediaId}/url?expiry=${expirySeconds}`);
    return response.url;
  } catch (error) {
    console.error('Failed to get image URL:', error);
    throw new Error('Failed to load image');
  }
};

/**
 * Generate CDN-optimized image URL
 * @param mediaId - The media ID
 * @param variant - Image variant (thumbnail, small, medium, large, original)
 * @param format - Image format (webp, jpeg, png)
 * @returns Promise with the CDN image URL, or null if image is missing
 */
export const getCDNImageUrl = async (
  mediaId: string, 
  variant: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'medium',
  format: 'webp' | 'jpeg' | 'png' = 'webp'
) => {
  try {
    const response = await apiClient.get(`/api/media/cdn/${mediaId}?variant=${variant}&format=${format}`);
    
    // Handle missing seed images gracefully - server returns { url: null, isMissing: true }
    if (response.url === null || response.isMissing) {
      return null;
    }
    
    return response.url;
  } catch (error) {
    console.error('Failed to get CDN image URL:', error);
    // Return null instead of throwing for missing images, let the UI handle fallbacks
    return null;
  }
};
