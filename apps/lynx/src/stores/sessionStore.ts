import { create } from 'zustand'
import { z } from 'zod'

const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  phone: z.string().optional(),
})

const userProfileSchema = z.object({
  id: z.string(),
  supabase_id: z.string(),
  username: z.string().nullable(),
  bio: z.string().optional(),
  profileImage: z.string().optional(),
})

export type AuthUser = z.infer<typeof authUserSchema>
export type UserProfile = z.infer<typeof userProfileSchema>

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
    if (authUser) {
      try {
        const validatedUser = authUserSchema.parse(authUser)
        set((state) => ({
          authUser: validatedUser,
          isNewUser: !state.userProfile?.username,
        }))
      } catch (error) {
        console.error('Invalid auth user data:', error)
      }
    } else {
      set({ authUser: null })
    }
  },
  setUserProfile: (userProfile) => {
    if (userProfile) {
      try {
        const validatedProfile = userProfileSchema.parse(userProfile)
        set((state) => ({
          userProfile: validatedProfile,
          isNewUser: state.authUser ? !validatedProfile.username : false,
        }))
      } catch (error) {
        console.error('Invalid profile data:', error)
      }
    } else {
      set({ userProfile: null })
    }
  },
  setIsLoading: (isLoading) => set({ isLoading }),
  clearSession: () =>
    set({
      authUser: null,
      userProfile: null,
      isNewUser: false,
    }),
}))
