import { drizzle } from 'drizzle-orm/d1'
import { Bindings } from '../types'
import * as schema from './schema'

export function createD1Client(bindings: Bindings) {
  const db = drizzle(bindings.DB, { schema: schema })
  return db
}
