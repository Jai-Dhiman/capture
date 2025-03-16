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

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

export type AuthStage = 'unauthenticated' | 'profile-creation' | 'phone-verification' | 'complete'

export interface AuthState {
  status: AuthStatus
  stage: AuthStage
  user: AuthUser | null
  session: AuthSession | null
  otpMessageId?: string

  setUser: (user: AuthUser | null) => void
  setSession: (session: AuthSession | null) => void
  setAuthStage: (stage: AuthStage) => void
  clearAuth: () => void
  setOtpMessageId: (id: string | undefined) => void
  resetPhoneVerification: () => void
  simulatePhoneVerification: () => void
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
      stage: 'unauthenticated',
      user: null,
      session: null,
      otpMessageId: undefined,

      setUser: (user) =>
        set({
          user,
          status: user ? 'authenticated' : 'unauthenticated',
        }),

      setSession: (session) => set({ session }),

      setAuthStage: (stage) => set({ stage }),

      clearAuth: () => {
        set({
          user: null,
          session: null,
          status: 'unauthenticated',
          stage: 'unauthenticated',
        })
      },
      setOtpMessageId: (id) => set({ otpMessageId: id }),

      resetPhoneVerification: () =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                phone_confirmed_at: undefined,
              }
            : null,
          otpMessageId: undefined,
        })),

      simulatePhoneVerification: () =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                phone_confirmed_at: new Date().toISOString(),
              }
            : null,
        })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
)
