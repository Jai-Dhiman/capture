export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface AuthUser {
  id: string;
  email: string;
  phone?: string;
  phone_confirmed_at?: string;
}

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";
export type AuthStage = "unauthenticated" | "profile-creation" | "phone-verification" | "complete";
