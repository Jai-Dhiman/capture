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
  
  // Add more API methods as needed
}; 