import { useAuthStore } from '@/features/auth/stores/authStore';
import Constants from 'expo-constants';

// Get API URL from EAS config or fallback
const API_URL = Constants.expoConfig?.extra?.API_URL || 
                process.env.API_URL || 
                'https://capture-api.jai-d.workers.dev';

console.log('🌐 API Client Configuration:', {
  API_URL,
  source: Constants.expoConfig?.extra?.API_URL ? 'EAS Config' : 
          process.env.API_URL ? 'Process Env' : 'Fallback'
});

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
      console.log('🌐 Making API request:', {
        method,
        url: fullUrl,
        headers,
        bodySize: data ? JSON.stringify(data).length : 0,
        hasAuth: requiresAuth,
        hasToken: !!token,
      });

      const response = await fetch(fullUrl, options);

      console.log('🌐 API response received:', {
        status: response.status,
        ok: response.ok,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
      });

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
