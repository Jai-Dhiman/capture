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
    try {
      return await SecureStore.getItemAsync(name)
    } catch (error) {
      console.error('SecureStore getItem error:', error)
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value)
    } catch (error) {
      console.error('SecureStore setItem error:', error)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name)
    } catch (error) {
      console.error('SecureStore removeItem error:', error)
    }
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

      setSession: (session) => {
        if (session) {
          SecureStore.setItemAsync('auth-token', session.access_token).catch((err) =>
            console.error('Failed to store auth token:', err)
          )
          SecureStore.setItemAsync('refresh-token', session.refresh_token).catch((err) =>
            console.error('Failed to store refresh token:', err)
          )
        } else {
          SecureStore.deleteItemAsync('auth-token').catch(console.error)
          SecureStore.deleteItemAsync('refresh-token').catch(console.error)
        }

        set({ session })
      },

      clearAuth: () => {
        SecureStore.deleteItemAsync('auth-token').catch(console.error)
        SecureStore.deleteItemAsync('refresh-token').catch(console.error)

        set({
          user: null,
          session: null,
          status: 'unauthenticated',
        })
      },
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
