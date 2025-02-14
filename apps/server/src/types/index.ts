import type { User } from '@supabase/supabase-js'

export type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  SUPABASE_URL: string
  SUPABASE_KEY: string
}

export type Variables = {
  user: User
}
