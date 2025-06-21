import { apiClient } from '@/shared/lib/apiClient';
import type {
  AuthResponse,
  BasicSuccessResponse,
  OAuthAppleRequest,
  OAuthGoogleRequest,
  PasskeyAuthenticationComplete,
  PasskeyAuthenticationRequest,
  PasskeyAuthenticationResponse,
  PasskeyListResponse,
  PasskeyRegistrationComplete,
  PasskeyRegistrationRequest,
  PasskeyRegistrationResponse,
  SendCodeRequest,
  SendCodeResponse,
  User,
  VerifyCodeRequest,
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
    // Send authorization code to backend for token exchange using the same iOS client ID
    // This avoids cross-client issues that occur with mismatched client IDs
    return apiClient.post('/auth/oauth/google', data, false);
  },

  async oauthGoogleToken(idToken: string): Promise<AuthResponse> {
    // Send Google ID token to backend for verification and user creation
    return apiClient.post('/auth/oauth/google/token', { idToken }, false);
  },

  async oauthApple(data: OAuthAppleRequest): Promise<AuthResponse> {
    return apiClient.post('/auth/oauth/apple', data, false);
  },

  // Passkey methods
  async passkeyRegistrationBegin(
    data: PasskeyRegistrationRequest,
  ): Promise<PasskeyRegistrationResponse> {
    return apiClient.post('/auth/passkey/register/begin', data, false);
  },

  async passkeyRegistrationComplete(
    data: PasskeyRegistrationComplete,
  ): Promise<BasicSuccessResponse> {
    return apiClient.post('/auth/passkey/register/complete', data, false);
  },

  async passkeyAuthenticationBegin(
    data: PasskeyAuthenticationRequest,
  ): Promise<PasskeyAuthenticationResponse> {
    return apiClient.post('/auth/passkey/authenticate/begin', data, false);
  },

  async passkeyAuthenticationComplete(data: PasskeyAuthenticationComplete): Promise<AuthResponse> {
    return apiClient.post('/auth/passkey/authenticate/complete', data, false);
  },

  async checkUserHasPasskeys(email: string): Promise<{ hasPasskeys: boolean }> {
    return apiClient.post('/auth/passkey/check', { email }, false);
  },

  async getPasskeys(): Promise<PasskeyListResponse> {
    return apiClient.get('/auth/passkey/list', true);
  },

  async deletePasskey(passkeyId: string): Promise<BasicSuccessResponse> {
    return apiClient.delete(`/auth/passkey/${passkeyId}`, true);
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
  },
};