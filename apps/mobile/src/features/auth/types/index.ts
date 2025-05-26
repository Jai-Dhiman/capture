export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  // Add any other fields your /auth/register endpoint expects, e.g., username if it creates a profile simultaneously
}

export interface User {
  id: string;
  email: string;
  // Add other user-specific fields you might get from the backend 
  // (e.g., emailVerified, phone, if your /auth/login or /auth/me returns them)
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Timestamp in milliseconds for when the access_token expires
}

export interface AuthResponse {
  session: Session;
  user: User;
  profileExists?: boolean; // As seen in your backend /login response
}

export interface RegisterResponse {
  message: string;
  userId: string; // As per your /auth/register backend response
}

export interface ResetPasswordPayload {
  email: string;
}

export interface UpdatePasswordPayload {
  // If using a reset token (not JWT based for this specific action)
  token?: string; 
  password: string;
}

export interface SendVerificationEmailPayload {
  email: string; // Or it might be empty if the backend uses the authenticated user's email
}

export interface VerifyEmailPayload {
  token: string; // The verification token from the email link
}

export interface BasicSuccessResponse {
  success: boolean;
  message: string;
  code?: string; // Optional error code from backend
  details?: any; // Optional error details
}

// Zustand store related types
export type AuthStage = 'idle' | 'unauthenticated' | 'authenticated' | 'profileRequired' | 'emailVerificationRequired';
export type AuthStatus = 'checking' | 'pending' | 'error' | 'success';

export interface AuthStoreState {
  user: User | null;
  session: Session | null;
  stage: AuthStage;
  status: AuthStatus;
  error: string | null;
}

export interface AuthStoreActions {
  setAuthData: (data: AuthResponse) => void;
  clearAuth: () => void;
  refreshSession: () => Promise<Session | null>;
  checkInitialSession: () => Promise<void>;
  setStage: (stage: AuthStage) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  setUser: (user: User | null) => void; 
} 