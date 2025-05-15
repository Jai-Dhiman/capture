import { useProfileStore } from "@features/profile/stores/profileStore";
import { useOnboardingStore } from "../stores/onboardingStore";
import type { AuthUser, AuthSession, AuthStage, AuthStoreApi } from "../types/authTypes";
import type { OnboardingStep } from "../stores/onboardingStore";

export const createAuthState = (store: AuthStoreApi) => ({
  async getAuthState(): Promise<{
    user: AuthUser | null;
    session: AuthSession | null;
    stage: AuthStage;
    profile: any | null;
  }> {
    const { user, session, stage } = store.getState();
    const { profile } = useProfileStore.getState();
    return { user, session, stage, profile };
  },

  setUser(user: AuthUser | null): void {
    const { setUser } = store.getState();
    setUser(user);
  },

  setSession(session: AuthSession | null): void {
    const { setSession } = store.getState();
    setSession(session);
  },

  setProfile(profile: any | null): void {
    const { setProfile } = useProfileStore.getState();
    setProfile(profile);
  },

  setAuthStage(stage: AuthStage): void {
    const { setAuthStage } = store.getState();
    setAuthStage(stage);
  },

  setAuthenticated(user: AuthUser, session: AuthSession, profile: any | null): void {
    this.setUser(user);
    this.setSession(session);

    if (profile) {
      this.setProfile(profile);
      this.setAuthStage("complete");
    } else {
      this.setAuthStage("profile-creation");
    }
  },

  clearAuth(): void {
    const { clearAuth } = store.getState();
    const { clearProfile } = useProfileStore.getState();
    clearAuth();
    clearProfile();
  },

  setPhoneVerified(phone: string): void {
    const { user } = store.getState();
    if (user) {
      this.setUser({
        ...user,
        phone,
        phone_confirmed_at: new Date().toISOString(),
      });
    }
  },

  updateOnboardingStep(step: OnboardingStep): void {
    const { goToStep } = useOnboardingStore.getState();
    goToStep(step);
  },

  beginRefreshingSession(): void {
    const { setIsRefreshing } = store.getState();
    setIsRefreshing(true);
  },

  endRefreshingSession(error?: string): void {
    const { setIsRefreshing, setLastRefreshError } = store.getState();
    setIsRefreshing(false);
    setLastRefreshError(error);
  },
});

export let authState = createAuthState({
  getState: () => {
    throw new Error("Auth state used before initialization");
  },
});

export const initAuthState = (store: AuthStoreApi) => {
  authState = createAuthState(store);
};
