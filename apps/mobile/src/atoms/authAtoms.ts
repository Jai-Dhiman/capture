import { atom } from 'jotai'
import { useAuthStore } from '../stores/authStore'
import { useProfileStore } from '../stores/profileStore'

export const authStateAtom = atom(() => useAuthStore.getState())

export const profileStateAtom = atom(() => useProfileStore.getState())

export const isAuthenticatedAtom = atom((get) => {
  const { user, status } = get(authStateAtom)
  return status === 'authenticated' && !!user
})

export const isPhoneVerifiedAtom = atom((get) => {
  const { user } = get(authStateAtom)
  return !!user?.phone && !!user?.phone_confirmed_at
})

export const hasProfileAtom = atom((get) => {
  const { profile } = get(profileStateAtom)
  return !!profile
})

export const authStageAtom = atom((get) => {
  const isAuthenticated = get(isAuthenticatedAtom)
  const hasProfile = get(hasProfileAtom)
  const isPhoneVerified = get(isPhoneVerifiedAtom)

  if (!isAuthenticated) return 'unauthenticated'
  if (!hasProfile) return 'profile-creation'
  if (!isPhoneVerified) return 'phone-verification'
  return 'complete'
})
