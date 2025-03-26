import { API_URL } from "@env";
import crypto from "crypto-js";
import * as SecureStore from "expo-secure-store";
import * as Random from "expo-random";
import { encode as base64encode } from "base-64";
import { useAuthStore } from "../stores/authStore";

const AUTH_STORAGE_KEYS = {
  SESSION: "auth_session",
  USER: "auth_user",
  CODE_VERIFIER: "pkce_code_verifier",
};

export class AuthError extends Error {
  code: string;
  constructor(message: string, code: string = "auth/unknown") {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

async function generateCodeVerifier(): Promise<string> {
  const randomBytes = await Random.getRandomBytesAsync(32);
  const verifier = base64encode(String.fromCharCode(...new Uint8Array(randomBytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return verifier.substring(0, 128);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.SHA256(verifier);
  return base64encode(hash.toString(crypto.enc.Base64)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function storeCodeVerifier(verifier: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_STORAGE_KEYS.CODE_VERIFIER, verifier);
}

async function getStoredCodeVerifier(): Promise<string | null> {
  return await SecureStore.getItemAsync(AUTH_STORAGE_KEYS.CODE_VERIFIER);
}

async function clearCodeVerifier(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_STORAGE_KEYS.CODE_VERIFIER);
}

async function storeSessionData(session: any, user: any): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(session));
    await SecureStore.setItemAsync(AUTH_STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error("Failed to store session data:", error);
    throw new AuthError("Failed to save session data", "auth/storage-failed");
  }
}

async function clearSessionData(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_STORAGE_KEYS.SESSION);
    await SecureStore.deleteItemAsync(AUTH_STORAGE_KEYS.USER);
  } catch (error) {
    console.error("Failed to clear session data:", error);
  }
}

export const authService = {
  async signIn(email: string, password: string) {
    try {
      const response = await fetch(`${API_URL}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Authentication failed", data.code || "auth/sign-in-failed");
      }

      // Store the session data securely
      if (data.session && data.user) {
        await storeSessionData(data.session, data.user);
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "Authentication failed");
    }
  },

  async signUp(email: string, password: string) {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Registration failed", data.code || "auth/sign-up-failed");
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "Registration failed");
    }
  },

  async refreshToken(refreshToken: string) {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Failed to refresh token", data.code || "auth/refresh-failed");
      }

      // Update the stored session with the new tokens
      const { user } = useAuthStore.getState();
      if (user) {
        await storeSessionData(
          {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at,
          },
          user
        );
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "Token refresh failed");
    }
  },

  async resetPassword(email: string) {
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Failed to reset password", data.code || "auth/reset-failed");
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "Password reset failed");
    }
  },

  async updatePassword(password: string, token: string) {
    try {
      const response = await fetch(`${API_URL}/auth/update-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Failed to update password", data.code || "auth/update-failed");
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "Password update failed");
    }
  },

  async sendOTP(phone: string, token: string) {
    try {
      const response = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Failed to send verification code", data.code || "auth/otp-failed");
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "Failed to send verification code");
    }
  },

  async verifyOTP(phone: string, code: string) {
    try {
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, token: code }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Failed to verify code", data.code || "auth/verify-failed");
      }

      const { user, session } = useAuthStore.getState();
      if (user && session) {
        const updatedUser = {
          ...user,
          phone,
          phone_confirmed_at: new Date().toISOString(),
        };
        await storeSessionData(session, updatedUser);
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "Failed to verify code");
    }
  },

  async signInWithProvider(provider: "google" | "apple") {
    try {
      const codeVerifier = await generateCodeVerifier();
      await storeCodeVerifier(codeVerifier);

      const codeChallenge = await generateCodeChallenge(codeVerifier);

      const response = await fetch(`${API_URL}/auth/oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "OAuth authentication failed", data.code || "auth/oauth-failed");
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "OAuth authentication failed");
    }
  },

  async handleAuthCallback(url: string) {
    try {
      const codeVerifier = await getStoredCodeVerifier();

      const response = await fetch(`${API_URL}/auth/handle-callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          code_verifier: codeVerifier,
        }),
      });

      await clearCodeVerifier();

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Failed to process authentication", data.code || "auth/callback-failed");
      }

      if (data.session && data.user) {
        await storeSessionData(data.session, data.user);

        if (url.includes("type=recovery")) {
          return "/auth/reset-password";
        } else if (url.includes("type=signup")) {
          return "/auth/login";
        }
      }

      return null;
    } catch (error) {
      await clearCodeVerifier();
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "Authentication callback failed");
    }
  },

  async fetchUserProfile(userId: string, token: string) {
    try {
      const checkResponse = await fetch(`${API_URL}/api/profile/check/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!checkResponse.ok) throw new Error("Profile check failed");

      const checkData = await checkResponse.json();

      if (checkData.exists) {
        const profileResponse = await fetch(`${API_URL}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `
              query GetProfile($userId: ID!) {
                profile(id: $userId) {
                  id
                  userId
                  username
                  bio
                  profileImage
                }
              }
            `,
            variables: { userId },
          }),
        });

        if (!profileResponse.ok) throw new Error("Failed to fetch profile");

        const data = await profileResponse.json();
        if (data.errors) {
          throw new Error(data.errors[0]?.message || "Failed to fetch profile");
        }

        return data.data.profile;
      }

      return null;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  },

  async restoreSession() {
    try {
      const sessionData = await SecureStore.getItemAsync(AUTH_STORAGE_KEYS.SESSION);
      const userData = await SecureStore.getItemAsync(AUTH_STORAGE_KEYS.USER);

      if (!sessionData || !userData) {
        return false;
      }

      const session = JSON.parse(sessionData);
      const user = JSON.parse(userData);

      if (!session.access_token || !session.refresh_token) {
        await clearSessionData();
        return false;
      }

      const expiresAt = new Date(session.expires_at).getTime();
      const now = Date.now();

      if (expiresAt - now < 5 * 60 * 1000) {
        try {
          const refreshedData = await this.refreshToken(session.refresh_token);
          if (!refreshedData) {
            await clearSessionData();
            return false;
          }

          const { setUser, setSession } = useAuthStore.getState();
          setUser(user);
          setSession({
            access_token: refreshedData.access_token,
            refresh_token: refreshedData.refresh_token,
            expires_at: new Date(refreshedData.expires_at).getTime(),
          });

          return true;
        } catch (error) {
          console.error("Failed to refresh token during session restore:", error);
          await clearSessionData();
          return false;
        }
      } else {
        const { setUser, setSession } = useAuthStore.getState();

        setUser(user);
        setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: expiresAt,
        });

        return true;
      }
    } catch (error) {
      console.error("Failed to restore session:", error);
      await clearSessionData();
      return false;
    }
  },

  async updateAuthStage() {
    const { user, setAuthStage } = useAuthStore.getState();
    const { profile } = await import("../stores/profileStore").then((m) => m.useProfileStore.getState());

    if (!user) {
      setAuthStage("unauthenticated");
      return;
    }

    if (user.phone && !user.phone_confirmed_at) {
      setAuthStage("phone-verification");
      return;
    }

    if (!profile) {
      const { session } = useAuthStore.getState();
      if (session?.access_token) {
        const profileData = await this.fetchUserProfile(user.id, session.access_token);

        if (!profileData) {
          setAuthStage("profile-creation");
          return;
        } else {
          const { setProfile } = await import("../stores/profileStore").then((m) => m.useProfileStore.getState());
          setProfile({
            id: profileData.id,
            userId: profileData.userId,
            username: profileData.username,
            bio: profileData.bio || undefined,
            profileImage: profileData.profileImage || undefined,
          });

          setAuthStage("complete");
          return;
        }
      } else {
        setAuthStage("profile-creation");
        return;
      }
    }

    setAuthStage("complete");
  },

  async logout() {
    try {
      await clearSessionData();

      const { clearAuth } = useAuthStore.getState();
      const { clearProfile } = await import("../stores/profileStore").then((m) => m.useProfileStore.getState());

      clearAuth();
      clearProfile();

      return true;
    } catch (error) {
      console.error("Logout error:", error);
      throw new AuthError("Failed to log out", "auth/logout-failed");
    }
  },

  async hasValidSession(): Promise<boolean> {
    try {
      const sessionData = await SecureStore.getItemAsync(AUTH_STORAGE_KEYS.SESSION);
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);
      const expiresAt = new Date(session.expires_at).getTime();

      return expiresAt > Date.now();
    } catch (error) {
      console.error("Error checking session validity:", error);
      return false;
    }
  },

  async validateSession(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/auth/validate-token`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Token validation error:", error);
      return false;
    }
  },

  async forceRefreshSession(): Promise<boolean> {
    try {
      const sessionData = await SecureStore.getItemAsync(AUTH_STORAGE_KEYS.SESSION);
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);
      if (!session.refresh_token) return false;

      const refreshedData = await this.refreshToken(session.refresh_token);
      if (!refreshedData) return false;

      const { setSession } = useAuthStore.getState();
      setSession({
        access_token: refreshedData.access_token,
        refresh_token: refreshedData.refresh_token,
        expires_at: new Date(refreshedData.expires_at).getTime(),
      });

      return true;
    } catch (error) {
      console.error("Force refresh session error:", error);
      return false;
    }
  },
};
