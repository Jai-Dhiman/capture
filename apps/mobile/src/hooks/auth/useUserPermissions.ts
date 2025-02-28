import { useSessionStore } from '../../stores/sessionStore'
import { useProfile } from './useProfile'

export function useUserPermissions() {
  const { authUser } = useSessionStore()
  const { data: profile } = useProfile(authUser?.id)

  const canCreateContent = !!profile?.phoneVerified

  return {
    canCreateContent,
    isPhoneVerified: !!profile?.phoneVerified,
  }
}
