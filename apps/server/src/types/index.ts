import type { User, Session } from 'better-auth/types'

export type Bindings = {
  DATABASE_URL: string
  BUCKET: R2Bucket
}

export type Variables = {
  user: User | null
  session: Session | null
}
