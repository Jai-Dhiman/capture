import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { AuthUser, AuthSession, AuthStage, AuthStatus } from "../types/authTypes";
import { authService } from "../services/authService";

export interface AuthState {
  status: AuthStatus;
  stage: AuthStage;
  user: AuthUser | null;
  session: AuthSession | null;
  otpMessageId?: string;
  isRefreshing: boolean;
  lastRefreshError?: string;
  offlineRequests: Array<() => Promise<void>>;

  setUser: (user: AuthUser | null) => void;
  setSession: (session: AuthSession | null) => void;
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
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch (error) {
      console.error("SecureStore getItem error:", error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (error) {
      console.error("SecureStore setItem error:", error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      console.error("SecureStore removeItem error:", error);
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: "idle",
      stage: "unauthenticated",
      user: null,
      session: null,
      otpMessageId: undefined,
      isRefreshing: false,
      lastRefreshError: undefined,
      offlineRequests: [],

      setUser: (user) =>
        set({
          user,
          status: user ? "authenticated" : "unauthenticated",
        }),

      setSession: (session) => set({ session }),

      setAuthStage: (stage) => set({ stage }),

      clearAuth: () => {
        set({
          user: null,
          session: null,
          status: "unauthenticated",
          stage: "unauthenticated",
        });
      },

      setOtpMessageId: (id) => set({ otpMessageId: id }),

      resetPhoneVerification: () =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                phone_confirmed_at: undefined,
              }
            : null,
          otpMessageId: undefined,
        })),

      simulatePhoneVerification: () =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                phone_confirmed_at: new Date().toISOString(),
              }
            : null,
        })),

      setIsRefreshing: (value) => set({ isRefreshing: value }),

      setLastRefreshError: (error) => set({ lastRefreshError: error }),

      queueOfflineRequest: (request) =>
        set((state) => ({
          offlineRequests: [...state.offlineRequests, request],
        })),

      processOfflineQueue: async () => {
        const { offlineRequests } = get();
        if (offlineRequests.length === 0) return;

        const requests = [...offlineRequests];
        set({ offlineRequests: [] });

        for (const request of requests) {
          try {
            await request();
          } catch (error) {
            console.error("Failed to process offline request:", error);
          }
        }
      },

      refreshSession: async () => {
        const currentSession = get().session;
        if (!currentSession?.refresh_token) return null;

        set({ isRefreshing: true, lastRefreshError: undefined });

        try {
          const now = Date.now();
          const expiresAt = currentSession.expires_at;
          const shouldRefresh = expiresAt - now < 5 * 60 * 1000;

          if (!shouldRefresh) {
            set({ isRefreshing: false });
            return currentSession;
          }

          const refreshedSession = await authService.refreshToken(currentSession.refresh_token);

          set({
            session: {
              access_token: refreshedSession.access_token,
              refresh_token: refreshedSession.refresh_token,
              expires_at: new Date(refreshedSession.expires_at).getTime(),
            },
            isRefreshing: false,
          });

          return refreshedSession;
        } catch (error) {
          console.error("Failed to refresh session:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          set({ lastRefreshError: errorMessage, isRefreshing: false });

          return null;
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
