import { apiClient } from '@/shared/lib/apiClient';
import type { 
  SendCodeRequest, 
  SendCodeResponse, 
  VerifyCodeRequest, 
  AuthResponse, 
  BasicSuccessResponse,
  OAuthGoogleRequest,
  OAuthAppleRequest,
  User
} from '../types/index'; 

// Response shape for GET /auth/me
export interface MeResponse extends User {
  profileExists: boolean;
}

export const workersAuthApi = {
  // Passwordless authentication methods
  async sendCode(data: SendCodeRequest): Promise<SendCodeResponse> {
    return apiClient.post('/auth/send-code', data, false);
  },

  async verifyCode(data: VerifyCodeRequest): Promise<AuthResponse> {
    return apiClient.post('/auth/verify-code', data, false);
  },

  // Session management
  async logout(refreshToken?: string): Promise<BasicSuccessResponse> {
    const payload = refreshToken ? { refresh_token: refreshToken } : {};
    return apiClient.post('/auth/logout', payload, false);
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    return apiClient.post('/auth/refresh', { refresh_token: refreshToken }, false);
  },
  
  // OAuth methods
  async oauthGoogle(data: OAuthGoogleRequest): Promise<AuthResponse> {
    return apiClient.post('/auth/oauth/google', data, false);
  },

  async oauthApple(data: OAuthAppleRequest): Promise<AuthResponse> {
    return apiClient.post('/auth/oauth/apple', data, false);
  },
  
  // User info
  async getMe(): Promise<MeResponse | null> {
    try {
      const me = await apiClient.get('/auth/me', true);
      return me as MeResponse;
    } catch (error) {
      console.warn('getMe failed, possibly invalid token:', error);
      return null;
    }
  }
}; 