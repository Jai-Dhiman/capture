import { API_URL } from '@env'
import { supabase } from './supabase'

export async function checkProfileExists(userId: string): Promise<boolean> {
  try {
    const token = await supabase.auth.getSession().then((res) => res.data.session?.access_token)
    if (!token) return false

    const response = await fetch(`${API_URL}/api/profile/check/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) return false

    const data = await response.json()
    return data.exists
  } catch (error) {
    console.error('Error checking profile:', error)
    return false
  }
}
