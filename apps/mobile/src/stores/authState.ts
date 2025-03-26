import { useAuthStore } from "./authStore";
import { useProfileStore } from "./profileStore";
import { useOnboardingStore } from "./onboardingStore";
import { AuthUser, AuthSession, AuthStage } from "../types/authTypes";
import { OnboardingStep } from "./onboardingStore";

interface UserProfile {
  id: string;
  userId: string;
  username: string;
  bio?: string;
  profileImage?: string;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean | null;
}

export const authState = {
  async getAuthState(): Promise<{
    user: AuthUser | null;
    session: AuthSession | null;
    stage: AuthStage;
    profile: UserProfile | null;
  }> {
    const { user, session, stage } = useAuthStore.getState();
    const { profile } = useProfileStore.getState();
    return { user, session, stage, profile };
  },

  setUser(user: AuthUser | null): void {
    const { setUser } = useAuthStore.getState();
    setUser(user);
  },

  setSession(session: AuthSession | null): void {
    const { setSession } = useAuthStore.getState();
    setSession(session);
  },

  setProfile(profile: UserProfile | null): void {
    const { setProfile } = useProfileStore.getState();
    setProfile(profile);
  },

  setAuthStage(stage: AuthStage): void {
    const { setAuthStage } = useAuthStore.getState();
    setAuthStage(stage);
  },

  setAuthenticated(user: AuthUser, session: AuthSession, profile: UserProfile | null): void {
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
    const { clearAuth } = useAuthStore.getState();
    const { clearProfile } = useProfileStore.getState();
    clearAuth();
    clearProfile();
  },

  setPhoneVerified(phone: string): void {
    const { user } = useAuthStore.getState();
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
    const { setIsRefreshing } = useAuthStore.getState();
    setIsRefreshing(true);
  },

  endRefreshingSession(error?: string): void {
    const { setIsRefreshing, setLastRefreshError } = useAuthStore.getState();
    setIsRefreshing(false);
    setLastRefreshError(error);
  },
};
