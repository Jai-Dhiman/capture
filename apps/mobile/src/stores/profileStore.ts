import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserProfile {
  id: string;
  userId: string;
  username: string;
  bio?: string;
  profileImage?: string;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean | null;
  isPrivate?: boolean;
}

export interface ProfileState {
  profile: UserProfile | null;
  hasCompletedOnboarding: boolean;

  setProfile: (profile: UserProfile | null) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      hasCompletedOnboarding: false,

      setProfile: (profile) => set({ profile }),
      setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
      clearProfile: () => set({ profile: null }),
    }),
    {
      name: "profile-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
