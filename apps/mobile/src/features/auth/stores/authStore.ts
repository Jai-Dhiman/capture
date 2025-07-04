import { secureStorage } from '@/shared/lib/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  AuthResponse,
  AuthStage,
  AuthStatus,
  AuthStoreActions,
  AuthStoreState,
  Session,
  User,
} from '../types';

/*
 * AUTH DEBUGGING LOGS:
 *
 * Look for these console log prefixes to debug auth flow issues:
 * - [AUTH] - Auth store decisions and stage changes
 * - [API] - Server API requests and responses
 * - [NAVIGATION] - Navigation state changes
 * - [AUTH_NAVIGATOR] - Auth stack navigator decisions
 * - [EMAIL_VERIFICATION] - Email verification flow
 * - [PASSKEY_SETUP] - Passkey setup screen state
 * - [PASSKEY] - Passkey registration/authentication
 *
 * Key fields that determine auth stage:
 * - securitySetupRequired: true = shows PasskeySetupScreen
 * - profileExists: false = shows CreateProfile screen
 * - Both false = user is fully authenticated
 */

const initialState: AuthStoreState = {
  user: null,
  session: null,
  stage: 'unauthenticated',
  status: 'checking',
  error: null,
};

export const useAuthStore = create<AuthStoreState & AuthStoreActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAuthData: (data: AuthResponse) => {
        let stage: AuthStage = 'authenticated';

        // Security setup should happen before profile creation
        if (data.securitySetupRequired === true) {
          stage = 'securitySetupRequired';
        } else if (data.profileExists === false) {
          stage = 'profileRequired';
        }

        set({
          user: data.user,
          session: data.session,
          status: 'success',
          stage,
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
            const { workersAuthApi } = await import('../lib/workersAuthApi');
            await workersAuthApi.logout(currentSession.refresh_token);
          } catch (e) {
            console.warn('Logout API call failed during clearAuth:', e);
          }
        }
        set({
          user: null,
          session: null,
          stage: 'unauthenticated',
          status: 'success',
          error: null,
        });
      },

      refreshSession: async () => {
        const currentSession = get().session;
        if (!currentSession?.refresh_token) {
          await get().clearAuth();
          return null;
        }

        set({ status: 'pending', error: null });
        try {
          const { workersAuthApi } = await import('../lib/workersAuthApi');
          const authResponse = await workersAuthApi.refresh(currentSession.refresh_token);
          get().setAuthData(authResponse);
          return authResponse.session;
        } catch (error: any) {
          console.error('Failed to refresh session:', error);

          // Check for specific auth errors that indicate invalid refresh token
          const isAuthError =
            error?.response?.status === 401 ||
            error?.statusCode === 401 ||
            error?.response?.data?.code === 'auth/invalid-refresh-token' ||
            error?.message?.includes('auth/invalid-refresh-token');

          if (isAuthError) {
            await get().clearAuth();
          } else {
            set({ status: 'error', error: error.message || 'Failed to refresh session' });
          }
          return null;
        }
      },

      checkInitialSession: async () => {
        set({ status: 'checking', error: null });
        const currentSession = get().session;

        if (!currentSession?.access_token || !currentSession?.refresh_token) {
          set({
            status: 'success',
            stage: 'unauthenticated',
            user: null,
            session: null,
          });
          return;
        }

        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        // Check if token is expired or expiring soon
        if (currentSession.expires_at && currentSession.expires_at - now < fiveMinutes) {
          const refreshed = await get().refreshSession();
          if (!refreshed) {
            await get().clearAuth();
          }
        } else {
          // Token seems valid, verify with backend
          try {
            const { workersAuthApi } = await import('../lib/workersAuthApi');
            const me = await workersAuthApi.getMe();

            if (me) {
              let stage: AuthStage = 'authenticated';

              // Security setup should happen before profile creation
              if (me.securitySetupRequired) {
                stage = 'securitySetupRequired';
              } else if (!me.profileExists) {
                stage = 'profileRequired';
              } else {
              }

              set({
                user: { id: me.id, email: me.email },
                status: 'success',
                stage,
                error: null,
              });
            } else {
              const refreshed = await get().refreshSession();
              if (!refreshed) {
                await get().clearAuth();
              }
            }
          } catch (e) {
            console.warn('Session verification failed, attempting refresh:', e);
            const refreshed = await get().refreshSession();
            if (!refreshed) {
              await get().clearAuth();
            }
          }
        }
      },

      setStage: (stage: AuthStage) => set({ stage }),
      setStatus: (status: AuthStatus) => set({ status }),
      setError: (error: string | null) =>
        set((state) => ({ ...state, error, status: error ? 'error' : state.status })),
    }),
    {
      name: 'auth-session-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        stage: state.stage,
      }),
      onRehydrateStorage: (_state) => {
        return (_hydratedState, error) => {
          if (error) {
            console.error('Failed to rehydrate auth store:', error);
          }
        };
      },
    },
  ),
);

export function initializeAuth() {
  const { checkInitialSession } = useAuthStore.getState();
  checkInitialSession();
}
