// Passwordless auth types
export interface SendCodeRequest {
  email: string;
  phone?: string; // For registration
}

export interface SendCodeResponse {
  success: boolean;
  message: string;
  isNewUser: boolean;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
  phone?: string; // For registration
}

export interface User {
  id: string;
  email: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Timestamp in milliseconds for when the access_token expires
}

export interface AuthResponse {
  session: Session;
  user: User;
  profileExists?: boolean;
  isNewUser?: boolean;
}

export interface BasicSuccessResponse {
  success: boolean;
  message: string;
  code?: string; // Optional error code from backend
  details?: any; // Optional error details
}

// OAuth types
export interface OAuthGoogleRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OAuthAppleRequest {
  code: string;
  identityToken: string;
}

// Zustand store related types
export type AuthStage = 'unauthenticated' | 'profileRequired' | 'authenticated';
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