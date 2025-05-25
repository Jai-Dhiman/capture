export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user?: AuthUser;
}

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  phone_confirmed_at?: string;
}

export interface AuthStoreApi {
  getState: () => {
    user: AuthUser | null;
    session: AuthSession | null;
    stage: AuthStage;
    setUser: (user: AuthUser | null) => void;
    setSession: (session: AuthSession | null) => void;
    setAuthStage: (stage: AuthStage) => void;
    clearAuth: () => void;
    setIsRefreshing: (value: boolean) => void;
    setLastRefreshError: (error?: string) => void;
  };
}

export interface AuthState {
  status: AuthStatus;
  stage: AuthStage;
  user: AuthUser | null;
  session: AuthSession | null;
  profileExists?: boolean;
  otpMessageId?: string;
  isRefreshing: boolean;
  lastRefreshError?: string;
  offlineRequests: Array<() => Promise<void>>;

  setUser: (user: AuthUser | null, profileExists?: boolean) => void;
  setSession: (session: AuthSession | null, profileExists?: boolean) => void;
  setAuthenticatedData: (user: AuthUser | null, session: AuthSession | null, profileExists: boolean | undefined, stageOverride?: AuthStage) => void;
  setAuthStage: (stage: AuthStage) => void;
  clearAuth: () => void;
  setOtpMessageId: (id: string | undefined) => void;
  resetPhoneVerification: () => void;
  simulatePhoneVerification: () => void;
  refreshSession: () => Promise<AuthSession | null>;
  queueOfflineRequest: (request: () => Promise<void>) => void;
  processOfflineQueue: () => Promise<void>;
  setIsRefreshing: (value: boolean) => void;
  setLastRefreshError: (error: string | undefined) => void;
  checkInitialSession: () => Promise<void>;
}

export interface UserProfile {
  id: string;
  userId: string;
  username: string;
  bio?: string;
  profileImage?: string;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean | null;
}

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated" | "error";
export type AuthStage = "unauthenticated" | "profile-creation" | "phone-unverified" | "phone-verified" | "complete";
