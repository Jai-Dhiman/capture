import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureStorage } from "@shared/lib/storage";
import type { AuthState, AuthUser, AuthSession, AuthStage } from "../types/authTypes";
import { authApi, AuthError } from "../lib/authApi";

const initialStateForStore = {
  status: "idle" as AuthState["status"],
  stage: "unauthenticated" as AuthState["stage"],
  user: null as AuthUser | null,
  session: null as AuthSession | null,
  profileExists: undefined as boolean | undefined,
  otpMessageId: undefined as string | undefined,
  isRefreshing: false as boolean,
  lastRefreshError: undefined as string | undefined,
  offlineRequests: [] as Array<() => Promise<void>>,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialStateForStore,

      setUser: (user, profileExistsCurrent) =>
        set((state) => ({
          user,
          profileExists: profileExistsCurrent !== undefined ? profileExistsCurrent : state.profileExists,
          status: user ? "authenticated" : "unauthenticated",
        })),

      setSession: (session, profileExistsCurrent) =>
        set((state) => {
          const currentUser = state.user;
          const newStatus = session && currentUser ? "authenticated" : "unauthenticated";
          return {
            session,
            user: session ? currentUser : null,
            profileExists: session ? (profileExistsCurrent !== undefined ? profileExistsCurrent : state.profileExists) : undefined,
            status: newStatus,
          };
        }),

      setAuthenticatedData: (user: AuthUser | null, session: AuthSession | null, profileExistsValue: boolean | undefined, stageOverride?: AuthStage) => {
        set(state => {
          const newStatus = user && session ? "authenticated" : "unauthenticated";
          let newStage = state.stage;

          if (newStatus === "authenticated") {
            if (stageOverride) {
              newStage = stageOverride;
            } else if (profileExistsValue === false) {
              newStage = "profile-creation";
            } else if (profileExistsValue === true) {
              if (state.stage !== "phone-verified" && state.stage !== "complete") {
                if (user && !user.phone_confirmed_at) {
                  newStage = "phone-unverified";
                } else {
                  newStage = "complete";
                }
              } else {
                newStage = state.stage;
              }
            }
          } else {
            newStage = "unauthenticated";
          }

          return {
            user,
            session,
            profileExists: profileExistsValue,
            status: newStatus,
            stage: newStage,
            isRefreshing: false,
            lastRefreshError: undefined,
          };
        });
      },

      setAuthStage: (stage) => set({ stage }),

      clearAuth: () => {
        set({ ...initialStateForStore, status: "unauthenticated", profileExists: undefined });
        authApi.clearSessionData();
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
          stage: state.user ? "phone-unverified" : state.stage,
        })),

      simulatePhoneVerification: () =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                phone_confirmed_at: new Date().toISOString(),
              }
            : null,
          stage: state.user ? "phone-verified" : state.stage,
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
          get().clearAuth();
          return null;
        }

        set({ isRefreshing: true, lastRefreshError: undefined });
        try {
          const response = await authApi.refreshToken(currentSession.refresh_token);
          get().setAuthenticatedData(response.user, response.session, response.profileExists);
          await authApi.storeSessionData(response.session, response.user);
          return response.session;
        } catch (error) {
          console.error("Failed to refresh session (store):", error);
          set({ lastRefreshError: error instanceof Error ? error.message : "Unknown refresh error", isRefreshing: false });
          if (error instanceof AuthError && (error.code === 'auth/refresh-failed' || error.message.includes("Invalid Refresh Token"))) {
            get().clearAuth();
          }
          return null;
        }
      },

      checkInitialSession: async () => {
        set({ status: "loading" });
        try {
          const storedData = await authApi.getStoredSessionData();
          if (storedData?.session && storedData?.user) {
            const validationResponse = await authApi.validateSession(storedData.session, storedData.user);
            if (validationResponse.success && validationResponse.user && validationResponse.profileExists !== undefined) {
              get().setAuthenticatedData(validationResponse.user as AuthUser, storedData.session as AuthSession, validationResponse.profileExists);
              await authApi.storeSessionData(storedData.session, validationResponse.user as AuthUser);
            } else if (storedData.session.refresh_token) {
              console.log("Initial session validation failed or profileExists missing, attempting refresh...");
              await get().refreshSession();
            } else {
              get().clearAuth();
            }
          } else {
            get().clearAuth();
            set({ status: "unauthenticated" });
          }
        } catch (error) {
          console.error("Error during checkInitialSession:", error);
          get().clearAuth();
          set({ status: "error" });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        status: state.status,
        stage: state.stage,
        otpMessageId: state.otpMessageId,
      }),
    }
  )
);

export function initAuthState(store: typeof useAuthStore) {
  store.getState().checkInitialSession();
}
