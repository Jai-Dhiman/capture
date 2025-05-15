import { useAuthStore } from '@features/auth/stores/authStore';
import { API_URL } from '@env';

class APIError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
  }
}

export const apiClient = {
  async get(endpoint: string, requiresAuth = true) {
    return this.request("GET", endpoint, null, requiresAuth);
  },

  async post(endpoint: string, data: any, requiresAuth = true) {
    return this.request("POST", endpoint, data, requiresAuth);
  },

  async put(endpoint: string, data: any, requiresAuth = true) {
    return this.request("PUT", endpoint, data, requiresAuth);
  },

  async delete(endpoint: string, requiresAuth = true) {
    return this.request("DELETE", endpoint, null, requiresAuth);
  },

  async request<T = any>(
    method: string,
    endpoint: string,
    data: any = null,
    requiresAuth = true,
    retryCount = 0
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
        } else {
          throw new APIError("No auth token available", 401);
        }
      }

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
        "Content-Type": "application/json",
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

      const response = await fetch(`${API_URL}${endpoint}`, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(errorData.message || `Request failed with status ${response.status}`, response.status);
      }

      if (response.status === 204) {
        return null as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(error instanceof Error ? error.message : "Request failed");
    }
  },
};
