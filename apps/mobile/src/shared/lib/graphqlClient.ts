import { useAuthStore } from '@/features/auth/stores/authStore';
import { API_URL } from '@env';

interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
}

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function graphqlFetch<T = any>(
  request: GraphQLRequest,
  options: { requiresAuth?: boolean } = { requiresAuth: true }
): Promise<T> {
  const { session, refreshSession } = useAuthStore.getState();
  let token = session?.access_token;

  // Check if token needs refresh (expires within 5 minutes)
  if (options.requiresAuth && token && session?.expires_at) {
    const isExpiringSoon = session.expires_at - Date.now() < 5 * 60 * 1000;
    if (isExpiringSoon) {
      try {
        const refreshedSession = await refreshSession();
        token = refreshedSession?.access_token || token;
      } catch (error) {
        console.warn('Token refresh failed in graphqlFetch:', error);
      }
    }
  }

  if (options.requiresAuth && !token) {
    throw new Error('No auth token available');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.requiresAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const { data, errors }: GraphQLResponse<T> = await response.json();
  
  if (errors) {
    throw new Error(errors[0].message);
  }

  return data as T;
}