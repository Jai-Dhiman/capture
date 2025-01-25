import { create } from 'zustand'
import { authClient } from '../lib/auth-client'

interface AuthState {
  session: any | null
  isLoading: boolean
  error: Error | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: false,
  error: null,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await authClient.signIn.email({
        email,
        password,
      })
      set({ session: data, isLoading: false })
    } catch (error) {
      set({ error: error as Error, isLoading: false })
    }
  },

  signUp: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await authClient.signUp.email({
        email,
        password,
        name,
      })
      set({ session: data, isLoading: false })
    } catch (error) {
      set({ error: error as Error, isLoading: false })
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null })
    try {
      await authClient.signOut()
      set({ session: null, isLoading: false })
    } catch (error) {
      set({ error: error as Error, isLoading: false })
    }
  },
}))
