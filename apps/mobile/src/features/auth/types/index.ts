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

// PKCE types
export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

// OAuth configuration
export interface OAuthConfig {
  googleClientId?: string;
  appleClientId?: string;
}

// Passkey/WebAuthn types
export interface PasskeyCapabilities {
  supported: boolean;
  biometricsAvailable: boolean;
  deviceType: 'iOS' | 'Android' | 'unsupported';
  biometricTypes: string[]; // ['FaceID', 'TouchID', 'Fingerprint', etc.]
}

export interface PasskeyRegistrationRequest {
  email: string;
  deviceName?: string;
}

export interface PasskeyRegistrationResponse {
  challenge: string;
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  rp: {
    id: string;
    name: string;
  };
  pubKeyCredParams: Array<{
    type: string;
    alg: number;
  }>;
  authenticatorSelection: {
    authenticatorAttachment: string;
    userVerification: string;
    residentKey?: string;
  };
  attestation: string;
  timeout: number;
}

export interface PasskeyRegistrationCredential {
  id: string;
  rawId: string;
  response: {
    attestationObject: string;
    clientDataJSON: string;
  };
  type: string;
}

export interface PasskeyRegistrationComplete {
  credential: PasskeyRegistrationCredential;
  deviceName?: string;
}

export interface PasskeyAuthenticationRequest {
  email: string;
}

export interface PasskeyAuthenticationResponse {
  challenge: string;
  allowCredentials: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
  userVerification: string;
  timeout: number;
}

export interface PasskeyAuthenticationCredential {
  id: string;
  rawId: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
  type: string;
}

export interface PasskeyAuthenticationComplete {
  credential: PasskeyAuthenticationCredential;
}

export interface PasskeyInfo {
  id: string;
  credentialId: string;
  deviceName?: string;
  deviceType?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface PasskeyListResponse {
  passkeys: PasskeyInfo[];
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
