import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import * as SecureStore from 'expo-secure-store'

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface AuthUser {
  id: string
  email: string
  phone?: string
  phone_confirmed_at?: string
}

export interface AuthState {
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  user: AuthUser | null
  session: AuthSession | null

  setUser: (user: AuthUser | null) => void
  setSession: (session: AuthSession | null) => void
  clearAuth: () => void
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(name)
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name)
  },
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: 'idle',
      user: null,
      session: null,

      setUser: (user) =>
        set({
          user,
          status: user ? 'authenticated' : 'unauthenticated',
        }),
      setSession: (session) => set({ session }),
      clearAuth: () =>
        set({
          user: null,
          session: null,
          status: 'unauthenticated',
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        session: null,
      }),
    }
  )
)
