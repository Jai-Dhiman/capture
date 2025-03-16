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

  return null
}
