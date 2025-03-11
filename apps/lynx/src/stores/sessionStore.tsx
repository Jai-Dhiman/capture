import { create } from 'zustand'

type User = {
  id: string
  email: string
}

type Profile = {
  id: string
  username: string
  displayName: string
}

type SessionState = {
  authUser: User | null
  userProfile: Profile | null
  isLoading: boolean
  setAuthUser: (user: User | null) => void
  setUserProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  authUser: null,
  userProfile: null,
  isLoading: true,
  setAuthUser: (user) => set({ authUser: user }),
  setUserProfile: (profile) => set({ userProfile: profile }),
  setLoading: (loading) => set({ isLoading: loading }),
  signOut: () => set({ authUser: null, userProfile: null }),
}))