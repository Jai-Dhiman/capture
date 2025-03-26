import { API_URL } from "@env";
import crypto from "crypto-js";
import * as SecureStore from "expo-secure-store";
import * as Random from "expo-random";
import { encode as base64encode } from "base-64";

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
  await SecureStore.setItemAsync("pkce_code_verifier", verifier);
}

async function getStoredCodeVerifier(): Promise<string | null> {
  return await SecureStore.getItemAsync("pkce_code_verifier");
}

async function clearCodeVerifier(): Promise<void> {
  await SecureStore.deleteItemAsync("pkce_code_verifier");
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

      await clearCodeVerifier(); // Clear it after use

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Failed to process authentication", data.code || "auth/callback-failed");
      }

      return data;
    } catch (error) {
      await clearCodeVerifier(); // Clear on error too
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
      // This would be a placeholder for any session restoration logic
      // It could involve checking secure storage, etc.
      return true;
    } catch (error) {
      console.error("Failed to restore session:", error);
      return false;
    }
  },

  updateAuthStage() {
    // This would be implementation specific
    // The idea is to check the current user state and update the auth stage
  },
};
