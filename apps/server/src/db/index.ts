import { drizzle } from 'drizzle-orm/d1'
import { Bindings } from '../types'

export default (bindings: Bindings) => {
  const db = drizzle(bindings.DB)
  return db
}
