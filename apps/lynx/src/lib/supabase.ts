import { createClient } from '@supabase/supabase-js'
import LynxStorage from './lynxStorage.ts'
import { useEffect } from '@lynx-js/react'

const supabase_url = process.env.SUPABASE_URL || ''
const supabase_key = process.env.SUPABASE_KEY || ''

export const supabase = createClient(supabase_url, supabase_key, {
  auth: {
    storage: LynxStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
})

export function initSupabaseRefresh() {
  useEffect(() => {
    supabase.auth.startAutoRefresh()

    return () => {
      supabase.auth.stopAutoRefresh()
    }
  }, [])
}
