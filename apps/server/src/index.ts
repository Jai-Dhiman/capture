import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

app.onError((err, c) => {
  console.error(`${err}`)
  return c.json({
    error: err.message || 'Internal Server Error'
  }, 500)
})

export default app