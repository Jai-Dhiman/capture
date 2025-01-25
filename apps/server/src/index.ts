import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/errorHandler'
import authRoutes from './routes/auth'
import { auth } from './lib/auth'

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null
    session: typeof auth.$Infer.Session.session | null
  }
}>()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })
)
app.use('*', authMiddleware)

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.route('/api/auth', authRoutes)

app.get('/session', async (c) => {
  const session = c.get('session')
  const user = c.get('user')
  if (!user) return c.body(null, 401)
  return c.json({
    session,
    user,
  })
})

app.onError(errorHandler)

export default app
