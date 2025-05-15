import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureStorage } from "@shared/lib/storage";
import type { AuthState } from "../types/authTypes";
import { initAuthState } from "./authState";
import { authApi, AuthError } from "../lib/authApi";

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

        if (!currentSession?.refresh_token) {
          return null;
        }

        set({ isRefreshing: true, lastRefreshError: undefined });

        try {
          const now = Date.now();
          const expiresAt = currentSession.expires_at;

          const shouldRefresh = !expiresAt || expiresAt - now < 5 * 60 * 1000;

          if (!shouldRefresh) {
            set({ isRefreshing: false });
            return currentSession;
          }

          const refreshedData = await authApi.refreshToken(currentSession.refresh_token);

          if (!refreshedData || !refreshedData.access_token || !refreshedData.refresh_token) {
            throw new Error("Invalid refresh response");
          }

          const updatedSession = {
            access_token: refreshedData.access_token,
            refresh_token: refreshedData.refresh_token,
            expires_at: new Date(refreshedData.expires_at).getTime(),
          };

          const { user } = get();
          if (user) {
            await authApi.storeSessionData(updatedSession, user);
          }

          set({
            session: updatedSession,
            isRefreshing: false,
          });

          return updatedSession;
        } catch (error) {
          console.error("Failed to refresh session:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          set({ lastRefreshError: errorMessage, isRefreshing: false });

          if (
            error instanceof AuthError &&
            (error.message.includes("Invalid Refresh Token") || error.message.includes("Refresh Token Not Found"))
          ) {
            set({ session: null });
          }

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

initAuthState(useAuthStore);
