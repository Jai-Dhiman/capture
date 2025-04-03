import { authApi, AuthError } from "../lib/authApi";
import type { AuthSession, AuthStage, AuthUser, UserProfile } from "../types/authTypes";
import { authState } from "../stores/authState";

export const authService = {
  async signIn(
    email: string,
    password: string
  ): Promise<{
    user: AuthUser;
    session: AuthSession;
    profile: UserProfile | null;
  }> {
    const authData = await authApi.signIn(email, password);

    await authApi.storeSessionData(authData.session, authData.user);

    if (!authData.user?.email_confirmed_at) {
      throw new AuthError("Please verify your email before logging in", "auth/email-not-verified");
    }

    const profileData = await authApi.fetchUserProfile(authData.user.id, authData.session.access_token);

    let nextStage: AuthStage = "unauthenticated";

    if (!authData.user.phone_confirmed_at) {
      nextStage = "phone-verification";
    } else if (!profileData) {
      nextStage = "profile-creation";
    } else {
      nextStage = "complete";
    }

    authState.setAuthStage(nextStage);

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email || "",
        phone: authData.user.phone || "",
        phone_confirmed_at: authData.user.phone_confirmed_at || undefined,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: new Date(authData.session.expires_at || "").getTime(),
      },
      profile: profileData,
    };
  },

  async signUp(email: string, password: string) {
    const authData = await authApi.signUp(email, password);
    return authData;
  },

  async logout() {
    await authApi.clearSessionData();
    return true;
  },

  async refreshSession(refreshToken: string) {
    const refreshedData = await authApi.refreshToken(refreshToken);

    const { user } = await authState.getAuthState();
    if (user) {
      await authApi.storeSessionData(
        {
          access_token: refreshedData.access_token,
          refresh_token: refreshedData.refresh_token,
          expires_at: refreshedData.expires_at,
        },
        user
      );
    }

    return {
      access_token: refreshedData.access_token,
      refresh_token: refreshedData.refresh_token,
      expires_at: new Date(refreshedData.expires_at).getTime(),
    };
  },

  async restoreSession(): Promise<boolean> {
    try {
      const storedData = await authApi.getStoredSessionData();
      if (!storedData) return false;

      const { session, user } = storedData;

      if (!session.access_token || !session.refresh_token) {
        await authApi.clearSessionData();
        return false;
      }

      const expiresAt = new Date(session.expires_at).getTime();
      const now = Date.now();

      if (expiresAt - now < 5 * 60 * 1000) {
        try {
          const refreshedSession = await this.refreshSession(session.refresh_token);

          authState.setUser(user);
          authState.setSession({
            access_token: refreshedSession.access_token,
            refresh_token: refreshedSession.refresh_token,
            expires_at: refreshedSession.expires_at,
          });

          return true;
        } catch (error) {
          console.error("Failed to refresh token during session restore:", error);
          await authApi.clearSessionData();
          return false;
        }
      } else {
        authState.setUser(user);
        authState.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: expiresAt,
        });

        return true;
      }
    } catch (error) {
      console.error("Failed to restore session:", error);
      await authApi.clearSessionData();
      return false;
    }
  },

  async signInWithProvider(provider: "google" | "apple") {
    return await authApi.signInWithProvider(provider);
  },

  async handleAuthCallback(url: string) {
    try {
      console.log("Handling auth callback with URL:", url);

      if (!url || typeof url !== "string") {
        console.error("Invalid URL provided to handleAuthCallback:", url);
        return null;
      }

      // Only process URLs that contain auth parameters
      if (!url.includes("code=") && !url.includes("access_token=") && !url.includes("type=")) {
        console.log("URL doesn't contain auth parameters, not a callback");
        return null;
      }

      const codeVerifier = await authApi.getStoredCodeVerifier();
      console.log("Retrieved code verifier for callback:", codeVerifier ? "Yes" : "No");

      if (!codeVerifier && url.includes("code=")) {
        console.error("Missing code verifier for code-based flow");
        throw new Error("Authentication failed: Missing code verifier");
      }

      // Fix: Update to match your authApi method signature
      const data = await authApi.handleAuthCallback(url);

      if (!data) {
        return null;
      }

      if (data.session && data.user) {
        await authApi.storeSessionData(data.session, data.user);

        if (url.includes("type=recovery")) {
          return "/auth/reset-password";
        } else if (url.includes("type=signup")) {
          return "/auth/login";
        }

        // Fix: Update to match your determineAuthStage method signature
        const stage = await this.determineAuthStage();
        authState.setAuthStage(stage);

        // If we have a complete authentication, redirect to the app
        if (stage === "complete") {
          return "/feed";
        } else if (stage === "phone-verification") {
          return "/auth/verify-phone";
        } else if (stage === "profile-creation") {
          return "/auth/create-profile";
        }
      }

      return null;
    } catch (error) {
      console.error("Auth callback handling error:", error);
      throw error;
    }
  },

  async resetPassword(email: string) {
    return await authApi.resetPassword(email);
  },

  async updatePassword(password: string, token: string) {
    return await authApi.updatePassword(password, token);
  },

  async sendOTP(phone: string, token: string) {
    return await authApi.sendOTP(phone, token);
  },

  async verifyOTP(phone: string, code: string) {
    const data = await authApi.verifyOTP(phone, code);

    const { user, session } = await authState.getAuthState();
    if (user && session) {
      const updatedUser = {
        ...user,
        phone,
        phone_confirmed_at: new Date().toISOString(),
      };
      await authApi.storeSessionData(session, updatedUser);
      authState.setUser(updatedUser);
    }

    return data;
  },

  async determineAuthStage() {
    const { user, profile } = await authState.getAuthState();

    if (!user) {
      return "unauthenticated";
    }

    if (!user.phone_confirmed_at) {
      return "phone-verification";
    }

    if (!profile) {
      const { session } = await authState.getAuthState();
      if (session?.access_token) {
        const profileData = await authApi.fetchUserProfile(user.id, session.access_token);

        if (!profileData) {
          return "profile-creation";
        } else {
          authState.setProfile(profileData);
          return "complete";
        }
      } else {
        return "profile-creation";
      }
    }

    return "complete";
  },
};
