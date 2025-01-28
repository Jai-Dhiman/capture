// src/stores/authStore.ts
import { create } from 'zustand'

interface AuthState {
  session: any | null
  setSession: (session: any) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  clearSession: () => set({ session: null }),
}))
