import { useAuthStore } from "../stores/authStore";
import { API_URL } from "@env";

class APIError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
  }
}

export const apiClient = {
  async get(endpoint: string, requiresAuth: boolean = true) {
    return this.request("GET", endpoint, null, requiresAuth);
  },

  async post(endpoint: string, data: any, requiresAuth: boolean = true) {
    return this.request("POST", endpoint, data, requiresAuth);
  },

  async put(endpoint: string, data: any, requiresAuth: boolean = true) {
    return this.request("PUT", endpoint, data, requiresAuth);
  },

  async delete(endpoint: string, requiresAuth: boolean = true) {
    return this.request("DELETE", endpoint, null, requiresAuth);
  },

  async request(method: string, endpoint: string, data: any = null, requiresAuth: boolean = true) {
    try {
      const { session, refreshSession } = useAuthStore.getState();

      let token = session?.access_token;

      if (requiresAuth && token && session?.expires_at) {
        const isExpiringSoon = session.expires_at - Date.now() < 5 * 60 * 1000;
        if (isExpiringSoon) {
          const refreshedSession = await refreshSession();
          token = refreshedSession?.access_token;
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (requiresAuth && token) {
        headers["Authorization"] = `Bearer ${token}`;
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
        return null;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(error instanceof Error ? error.message : "Request failed");
    }
  },
};
