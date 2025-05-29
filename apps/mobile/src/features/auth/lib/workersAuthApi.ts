import { apiClient } from '@shared/lib/apiClient';
import type { LoginCredentials, RegisterData, ResetPasswordPayload, UpdatePasswordPayload, VerifyEmailPayload, SendVerificationEmailPayload, AuthResponse, RegisterResponse, BasicSuccessResponse } from '../types/index'; 
import type { User } from '../types/index';

// Response shape for GET /auth/me
export interface MeResponse extends User {
  profileExists: boolean;
}

export const workersAuthApi = {
  async register(data: RegisterData): Promise<RegisterResponse> {
    // According to auth.ts, /register returns { message, userId } but doesn't auto-login.
    // Consider if the client needs to do anything with userId immediately or if it's just for confirmation.
    return apiClient.post('/auth/register', data, false); // Registration doesn't require prior auth
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return apiClient.post('/auth/login', credentials, false); // Login doesn't require prior auth
  },

  async logout(refreshToken?: string): Promise<BasicSuccessResponse> {
    // Backend /auth/logout can optionally take a refresh_token in the body
    const payload = refreshToken ? { refresh_token: refreshToken } : {};
    return apiClient.post('/auth/logout', payload, true); // Logout might need to invalidate a server-side session/token if applicable, so requiresAuth might be true or false depending on backend
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    return apiClient.post('/auth/refresh', { refresh_token: refreshToken }, false); // Refresh endpoint itself is not protected by JWT auth
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<BasicSuccessResponse> {
    // POST /reset-password on backend
    // Expects { email: string }
    // Returns { success: true, message: "..." }
    return apiClient.post('/auth/reset-password', payload, false);
  },

  async updatePassword(payload: UpdatePasswordPayload): Promise<BasicSuccessResponse> {
    // POST /update-password on backend
    // Expects { password: string } (if JWT authenticated)
    // or { token: string, password: string } (if using reset token - this needs clarification from backend implementation)
    // For now, assuming JWT authenticated as per current backend structure of updatePassword
    // If it uses a token from an email link, the 'requiresAuth' might be false, and token passed in payload
    return apiClient.post('/auth/update-password', { password: payload.password }, true);
  },

  async sendVerificationEmail(payload: SendVerificationEmailPayload): Promise<BasicSuccessResponse> {
    // This endpoint (e.g., POST /auth/send-verification-email) needs to be implemented on the backend first.
    // It would likely take { email: string } or be called for the currently logged-in user.
    // Assuming it's for a logged-in (or just registered) user and takes the user's email or relies on session.
    // For now, let's assume it takes an email and is called after registration or if user requests it.
    // Requires backend to be implemented.
    // For the example, let's assume it takes an email.
    return apiClient.post('/auth/send-verification-email', payload, false); // Or true if it acts on an authenticated user without explicit email in payload
  },

  async verifyEmail(payload: VerifyEmailPayload): Promise<BasicSuccessResponse> {
    // This endpoint (e.g., GET /auth/verify-email?token=...) needs to be implemented on the backend.
    // The frontend would typically open a link like this, or extract the token and send it.
    // If the frontend sends it, it might be a POST to /auth/verify-email with { token: string }.
    // For now, let's assume a POST with a token.
    // Requires backend to be implemented.
    return apiClient.post('/auth/verify-email', payload, false); // Verification via token doesn't need prior JWT auth
  },
  
  // OAuth exchanges
  async oauthGoogle(data: { code: string; codeVerifier: string; redirectUri: string }): Promise<AuthResponse> {
    return apiClient.post('/auth/oauth/google', data, false);
  },
  async oauthApple(data: { code: string; identityToken: string }): Promise<AuthResponse> {
    return apiClient.post('/auth/oauth/apple', data, false);
  },
  
  // Optional: /auth/me endpoint to validate token and get user info
  async getMe(): Promise<MeResponse | null> {
    try {
      // GET /auth/me returns { id, email, profileExists }
      const me = await apiClient.get('/auth/me', true);
      return me as MeResponse;
    } catch (error) {
      console.warn('getMe failed, possibly invalid token:', error);
      return null;
    }
  }
}; 