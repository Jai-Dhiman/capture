import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SUPABASE_URL, SUPABASE_KEY } from '@env'
import { createContext, useContext, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type AuthUser, useSessionStore } from '../stores/sessionStore'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
})

type Session = {
  access_token: string
  refresh_token: string
  user: {
    id: string
    email?: string
  }
} | null

type SessionContextType = {
  authUser: AuthUser | null
  isLoading: boolean
}

const SessionContext = createContext<SessionContextType>({
  authUser: null,
  isLoading: true,
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const setAuthUser = useSessionStore((state) => state.setAuthUser)
  const setIsLoading = useSessionStore((state) => state.setIsLoading)
  const sessionStore = useSessionStore((state) => ({
    authUser: state.authUser,
    isLoading: state.isLoading,
  }))

  const fetchSession = async (): Promise<Session> => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()
      if (error) throw error
      return session
    } catch (error) {
      console.error('Session fetch error:', error)
      return null
    }
  }

  const {
    data: session,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
  })

  useEffect(() => {
    const updateSessionState = async () => {
      if (session) {
        const authUser = {
          id: session.user.id,
          email: session.user.email || '',
        }
        setAuthUser(authUser)
      } else {
        setAuthUser(null)
      }
      setIsLoading(isLoading)
    }

    updateSessionState()
  }, [session, isLoading, setAuthUser, setIsLoading])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const authUser = {
          id: session.user.id,
          email: session.user.email || '',
        }
        setAuthUser(authUser)
      } else {
        setAuthUser(null)
      }
      setIsLoading(false)
      await refetch()
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [setAuthUser, setIsLoading, refetch])

  return <SessionContext.Provider value={sessionStore}>{children}</SessionContext.Provider>
}

export const useSession = () => useContext(SessionContext)

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})
