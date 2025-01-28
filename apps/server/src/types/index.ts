import type { User, Session } from 'better-auth/types'

export type Bindings = {
  DATABASE_URL: string
}

export type Variables = {
  user: User | null
  session: Session | null
}
