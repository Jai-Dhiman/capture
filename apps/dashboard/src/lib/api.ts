import { config } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest(
  endpoint: string, 
  options: RequestInit = {}
): Promise<any> {
  const url = `${config.apiUrl}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API request failed: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Health check endpoint (root path)
  health: () => apiRequest('/'),
  
  // Analytics endpoints
  analytics: {
    overview: () => apiRequest('/api/analytics/overview'),
    userGrowth: () => apiRequest('/api/analytics/user-growth'),
    contentActivity: () => apiRequest('/api/analytics/content-activity'),
    topUsers: () => apiRequest('/api/analytics/top-users'),
    recentActivity: () => apiRequest('/api/analytics/recent-activity'),
  },
}; 