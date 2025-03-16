import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useProfileStore } from '../stores/profileStore'
import { API_URL } from '@env'
import { canSkipPhoneVerification, isDevelopment, TEST_EMAILS } from '../config/environment'
import { useOnboardingStore } from '../stores/onboardingStore'

export class AuthError extends Error {
  code: string

  constructor(message: string, code: string = 'auth/unknown') {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

export const authService = {
  async signInWithEmailPassword(email: string, password: string) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw new AuthError(authError.message, 'auth/sign-in-failed')

      if (!authData.user?.email_confirmed_at) {
        throw new AuthError('Please verify your email before logging in', 'auth/email-not-verified')
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new AuthError('No auth token available', 'auth/no-token')
      }

      const profileData = await this.fetchUserProfile(authData.user.id, session.access_token)

      return { user: authData.user, session, profile: profileData }
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError(error instanceof Error ? error.message : 'Authentication failed')
    }
  },

  async signUpWithEmailPassword(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw new AuthError(error.message, 'auth/sign-up-failed')
      return data
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError(error instanceof Error ? error.message : 'Registration failed')
    }
  },

  async signInWithOAuth(provider: 'google' | 'apple') {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw new AuthError(error.message, 'auth/oauth-failed')
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError(error instanceof Error ? error.message : 'OAuth authentication failed')
    }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new AuthError(error.message, 'auth/sign-out-failed')
  },

  async sendPhoneVerification(phone: string) {
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`

      const { error: updateError } = await supabase.auth.updateUser({
        phone: formattedPhone,
      })

      if (updateError) throw new AuthError(updateError.message, 'auth/update-phone-failed')

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      })

      if (otpError) throw new AuthError(otpError.message, 'auth/send-otp-failed')

      return formattedPhone
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError(
        error instanceof Error ? error.message : 'Failed to send verification code'
      )
    }
  },

  async verifyPhoneWithOTP(phone: string, token: string) {
    try {
      const { user } = useAuthStore.getState()

      if (isDevelopment && user?.email && TEST_EMAILS.includes(user.email)) {
        console.log('DEV MODE: Auto-verifying test account')
        return true
      }

      const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      })

      if (error) throw new AuthError(error.message, 'auth/verify-otp-failed')
      return true
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError(error instanceof Error ? error.message : 'Phone verification failed')
    }
  },

  async fetchUserProfile(userId: string, token: string) {
    try {
      const checkResponse = await fetch(`${API_URL}/api/profile/check/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!checkResponse.ok) {
        throw new AuthError('Profile check failed', 'profile/check-failed')
      }

      const checkData = await checkResponse.json()

      if (checkData.exists) {
        const profileResponse = await fetch(`${API_URL}/api/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!profileResponse.ok) {
          throw new AuthError('Failed to fetch profile', 'profile/fetch-failed')
        }

        return await profileResponse.json()
      }

      return null
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  },

  async restoreSession() {
    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) throw new AuthError(error.message, 'auth/get-session-failed')

      if (!data.session) return null

      const { user } = data.session

      const { setUser, setSession, setAuthStage } = useAuthStore.getState()
      const { setProfile } = useProfileStore.getState()

      setUser({
        id: user.id,
        email: user.email || '',
        phone: user.phone || '',
        phone_confirmed_at: user.phone_confirmed_at || undefined,
      })

      setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: new Date(data.session.expires_at || 0).getTime(),
      })

      const profileData = await this.fetchUserProfile(user.id, data.session.access_token)

      if (profileData) {
        setProfile(profileData)
      }

      this.updateAuthStage()

      return {
        user,
        session: data.session,
        profile: profileData,
      }
    } catch (error) {
      console.error('Failed to restore session:', error)
      return null
    }
  },

  async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw new AuthError(error.message, 'auth/reset-password-failed')
      return true
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError(
        error instanceof Error ? error.message : 'Failed to send password reset email'
      )
    }
  },

  async updatePassword(password: string) {
    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) throw new AuthError(error.message, 'auth/update-password-failed')
      return true
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError(error instanceof Error ? error.message : 'Failed to update password')
    }
  },

  updateAuthStage() {
    const { user, setAuthStage } = useAuthStore.getState()
    const { profile } = useProfileStore.getState()
    const { currentStep } = useOnboardingStore.getState()

    if (!user) {
      setAuthStage('unauthenticated')
      return
    }

    if (!profile) {
      setAuthStage('profile-creation')
      return
    }

    if (
      user.phone &&
      !user.phone_confirmed_at &&
      currentStep !== 'complete' &&
      !canSkipPhoneVerification(user.email)
    ) {
      setAuthStage('phone-verification')
      return
    }

    setAuthStage('complete')
  },
}
