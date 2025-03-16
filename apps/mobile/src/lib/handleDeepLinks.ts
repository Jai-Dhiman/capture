import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

export async function handleSupabaseDeepLink(url: string): Promise<string | null> {
  if (url.includes('auth/callback')) {
    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Error getting auth session:', error)
        return null
      }

      if (data.session) {
        const { setUser, setSession } = useAuthStore.getState()

        setUser({
          id: data.session.user.id,
          email: data.session.user.email || '',
          phone: data.session.user.phone || '',
          phone_confirmed_at: data.session.user.phone_confirmed_at || undefined,
        })

        setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: new Date(data.session.expires_at || '').getTime(),
        })

        return '/create-profile'
      }
    } catch (error) {
      console.error('Error handling auth callback:', error)
    }
  }

  try {
    const hashIndex = url.indexOf('#')
    if (hashIndex >= 0) {
      const hashPart = url.substring(hashIndex + 1)
      const hashParams = new URLSearchParams(hashPart)

      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (accessToken && type) {
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            console.error('Error setting session from tokens:', error)
          } else if (data.session) {
            const { setUser, setSession } = useAuthStore.getState()
            setUser({
              id: data.session.user.id,
              email: data.session.user.email || '',
              phone: data.session.user.phone || '',
              phone_confirmed_at: data.session.user.phone_confirmed_at || undefined,
            })
            setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: new Date(data.session.expires_at || '').getTime(),
            })
          }
        }

        if (type === 'recovery') {
          return '/auth/reset-password'
        } else if (type === 'signup') {
          return '/auth/login'
        }
      }
    }
  } catch (error) {
    console.error('Error handling URL token fragments:', error)
  }

  return null
}
