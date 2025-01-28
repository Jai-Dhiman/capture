// src/hooks/useAuth.ts
import { useMutation } from '@tanstack/react-query'
import { signIn } from '../api/auth'
import { useAuthStore } from '../stores/authStore'

export const useAuth = () => {
  const setSession = useAuthStore((state) => state.setSession)

  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: (data) => {
      setSession(data.session)
    },
  })

  return {
    signIn: signInMutation.mutate,
    isPending: signInMutation.isPending,
    error: signInMutation.error,
  }
}
