import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SUPABASE_URL, SUPABASE_KEY } from '@env'
import { createContext, useContext, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSessionStore } from '../stores/sessionStore'

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
  session: Session
  isLoading: boolean
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  isLoading: true,
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const setSession = useSessionStore((state) => state.setSession)
  const setIsLoading = useSessionStore((state) => state.setIsLoading)
  const sessionStore = useSessionStore((state) => ({
    session: state.session,
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
    setSession(session || null)
    setIsLoading(isLoading)
  }, [session, isLoading, setSession, setIsLoading])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setIsLoading(false)
      await refetch()
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [setSession, setIsLoading, refetch])

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
