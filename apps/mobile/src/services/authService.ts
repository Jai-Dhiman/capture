import { API_URL } from "@env";

export class AuthError extends Error {
  code: string;
  constructor(message: string, code: string = "auth/unknown") {
    super(message);
    this.name = "AuthError";
    this.code = code;
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
      const response = await fetch(`${API_URL}/auth/oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
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
      const response = await fetch(`${API_URL}/auth/handle-callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AuthError(data.error || "Failed to process authentication", data.code || "auth/callback-failed");
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(error instanceof Error ? error.message : "Authentication callback failed");
    }
  },
};
