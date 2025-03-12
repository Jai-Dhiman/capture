import { createClient } from '@supabase/supabase-js'
import LynxStorage from './lynxStorage.ts'

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
  console.log('Supabase refresh is now managed by BackgroundSession component')
}
