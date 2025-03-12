import { useState, useEffect } from '@lynx-js/react'

export function useMainThreadAuth() {
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    hasProfile: false,
    isLoading: false,
  })

  const [statusMessages, setStatusMessages] = useState({
    error: '',
    success: '',
  })

  // Handle auth state updates from background
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, ...data } = event.data || {}

      if (type === 'AUTH_STATE_UPDATE') {
        setAuthState(data)
      } else if (type === 'AUTH_LOGIN_SUCCESS' || type === 'AUTH_SIGNUP_SUCCESS') {
        setStatusMessages((prev) => ({
          ...prev,
          success: data.message,
          error: '',
        }))
      } else if (type === 'AUTH_LOGIN_ERROR' || type === 'AUTH_SIGNUP_ERROR') {
        setStatusMessages((prev) => ({
          ...prev,
          error: data.message,
          success: '',
        }))
      }
    }

    window.addEventListener('message', handleMessage)

    // Request initial state
    window.postMessage({ type: 'AUTH_GET_STATE' }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Auth methods for main thread components
  const login = (credentials: { email: string; password: string }) => {
    setAuthState((prev) => ({ ...prev, isLoading: true }))
    window.postMessage(
      {
        type: 'AUTH_LOGIN',
        data: credentials,
      },
      '*'
    )
  }

  const signup = (credentials: { email: string; password: string }) => {
    setAuthState((prev) => ({ ...prev, isLoading: true }))
    window.postMessage(
      {
        type: 'AUTH_SIGNUP',
        data: credentials,
      },
      '*'
    )
  }

  const logout = () => {
    window.postMessage({ type: 'AUTH_LOGOUT' }, '*')
  }

  const clearMessages = () => {
    setStatusMessages({ error: '', success: '' })
  }

  return {
    ...authState,
    login,
    signup,
    logout,
    errorMessage: statusMessages.error,
    successMessage: statusMessages.success,
    clearMessages,
  }
}
