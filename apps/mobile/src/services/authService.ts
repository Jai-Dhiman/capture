import { authApi, AuthError } from "../lib/authApi";
import type { AuthSession, AuthStage, AuthUser, UserProfile } from "../types/authTypes";
import { authState } from "../stores/authState";
import { supabaseAuthClient } from "lib/supabaseAuthClient";
import { getStoredCodeVerifier } from "lib/supabaseAuthClient";
import { secureStorage } from "lib/storage";

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

    if (!profileData) {
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
      if (!url || typeof url !== "string") {
        return null;
      }

      let code = null;
      try {
        const urlObj = new URL(url);
        code = urlObj.searchParams.get("code");
      } catch (error) {
        return null;
      }

      if (!code) {
        return null;
      }

      const codeVerifier = await secureStorage.getItem("sb-cksprfmynsulsqecwngc-auth-token-code-verifier");

      if (!codeVerifier) {
        console.error("Code verifier is missing, OAuth PKCE flow cannot complete");
        return "Auth";
      }

      const { data, error } = await supabaseAuthClient.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Error exchanging code for session:", error);
        throw new AuthError(error.message, error.name);
      }

      if (!data.session || !data.user) {
        console.error("Missing session or user in auth response");
        return null;
      }

      await authApi.storeSessionData(data.session, data.user);

      authState.setUser({
        id: data.user.id,
        email: data.user.email || "",
        phone: data.user.phone || "",
        phone_confirmed_at: data.user.phone_confirmed_at || undefined,
      });

      authState.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: new Date(data.session.expires_at || "").getTime(),
      });

      const profileData = await authApi.fetchUserProfile(data.user.id, data.session.access_token);
      if (profileData) {
        authState.setProfile(profileData);
      }

      if (url.includes("type=recovery")) {
        return "Auth";
      } else if (url.includes("type=signup")) {
        return "Auth";
      }

      const stage = await this.determineAuthStage();
      authState.setAuthStage(stage);

      if (stage === "complete") {
        return "App";
      } else if (stage === "profile-creation") {
        return "CreateProfile";
      }

      return "Auth";
    } catch (error) {
      console.error("Auth callback handling error:", error);
      return "Auth";
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
