import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureStorage } from "@/shared/lib/storage";
import type { AuthStoreState, AuthStoreActions, User, Session, AuthResponse, AuthStage, AuthStatus } from "../types";

const initialState: AuthStoreState = {
  user: null,
  session: null,
  stage: "unauthenticated",
  status: "checking",
  error: null,
};

export const useAuthStore = create<AuthStoreState & AuthStoreActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAuthData: (data: AuthResponse) => {
        set({
          user: data.user,
          session: data.session,
          status: "success",
          stage: data.profileExists === false ? "profileRequired" : "authenticated",
          error: null,
        });
      },

      setUser: (user: User | null) => {
        set({ user });
      },

      clearAuth: async () => {
        const currentSession = get().session;
        if (currentSession?.refresh_token) {
          try {
            const { workersAuthApi } = await import("../lib/workersAuthApi");
            await workersAuthApi.logout(currentSession.refresh_token);
          } catch (e) {
            console.warn("Logout API call failed during clearAuth:", e);
          }
        }
        set({ 
          user: null,
          session: null,
          stage: "unauthenticated", 
          status: "success",
          error: null 
        });
      },

      refreshSession: async () => {
        const currentSession = get().session;
        if (!currentSession?.refresh_token) {
          await get().clearAuth();
          return null;
        }

        set({ status: "pending", error: null });
        try {
          const { workersAuthApi } = await import("../lib/workersAuthApi");
          const authResponse = await workersAuthApi.refresh(currentSession.refresh_token);
          get().setAuthData(authResponse);
          return authResponse.session;
        } catch (error: any) {
          console.error("Failed to refresh session (store):", error);
          if (error?.response?.data?.code === "auth/invalid-refresh-token" || error?.statusCode === 401) {
            await get().clearAuth();
          } else {
            set({ status: "error", error: error.message || "Unknown refresh error" });
          }
          return null;
        }
      },

      checkInitialSession: async () => {
        set({ status: "checking", error: null });
        const currentSession = get().session;

        if (currentSession?.access_token && currentSession?.refresh_token) {
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;
          if (currentSession.expires_at && currentSession.expires_at - now < fiveMinutes) {
            const refreshed = await get().refreshSession();
            if (!refreshed) {
              get().clearAuth();
            }
          } else if (currentSession.expires_at && currentSession.expires_at - now >= fiveMinutes) {
            try {
              const { workersAuthApi } = await import("../lib/workersAuthApi");
              const me = await workersAuthApi.getMe();
              if (me) {
                set({
                  user: { id: me.id, email: me.email },
                  status: "success",
                  stage: me.profileExists ? 'authenticated' : 'profileRequired',
                  error: null,
                });
              } else {
                await get().clearAuth();
              }
            } catch (e) {
              console.warn("checkInitialSession: getMe failed, attempting refresh or clearing auth", e);
              const refreshed = await get().refreshSession();
              if (!refreshed) {
                await get().clearAuth();
              }
            }
          } else {
            const refreshed = await get().refreshSession();
            if (!refreshed) await get().clearAuth();
          }
        } else {
          await get().clearAuth();
        }
      },

      setStage: (stage: AuthStage) => set({ stage }),
      setStatus: (status: AuthStatus) => set({ status }),
      setError: (error: string | null) => set((state) => ({ ...state, error, status: error ? "error" : state.status })),

    }),
    {
      name: "auth-session-storage",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        stage: state.stage,
      }),
      onRehydrateStorage: (_state) => {
        return (_hydratedState, error) => {
          if (error) {
            console.error("Failed to rehydrate auth store:", error);
          } else {
          }
        };
      },
    }
  )
);

export function initializeAuth() {
  const { checkInitialSession } = useAuthStore.getState();
  checkInitialSession();
}
