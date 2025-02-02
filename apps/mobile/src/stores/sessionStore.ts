import { create } from 'zustand'

export type SessionState = {
  session: any | null
  isLoading: boolean
  setSession: (session: any | null) => void
  setIsLoading: (isLoading: boolean) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  isLoading: true,
  setSession: (session) => set({ session }),
  setIsLoading: (isLoading) => set({ isLoading }),
}))
