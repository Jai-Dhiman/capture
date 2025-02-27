import { create } from 'zustand'

export interface AuthUser {
  id: string
  email: string
  phone?: string
}

export interface UserProfile {
  id: string
  supabase_id: string
  username: string | null
  bio?: string
  image?: string
}

export type SessionState = {
  authUser: AuthUser | null
  userProfile: UserProfile | null
  isLoading: boolean
  isNewUser: boolean
  setAuthUser: (user: AuthUser | null) => void
  setUserProfile: (profile: UserProfile | null) => void
  setIsLoading: (isLoading: boolean) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  authUser: null,
  userProfile: null,
  isLoading: true,
  isNewUser: false,
  setAuthUser: (authUser) => {
    set((state) => ({
      authUser,
      isNewUser: authUser ? !state.userProfile?.username : false,
    }))
  },
  setUserProfile: (userProfile) => {
    set((state) => ({
      userProfile,
      isNewUser: state.authUser ? !userProfile?.username : false,
    }))
  },
  setIsLoading: (isLoading) => set({ isLoading }),
  clearSession: () =>
    set({
      authUser: null,
      userProfile: null,
      isNewUser: false,
    }),
}))
