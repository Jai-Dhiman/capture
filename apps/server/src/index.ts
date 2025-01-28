import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { authMiddleware } from 'middleware/auth'
import { errorHandler } from 'middleware/errorHandler'
import type { Bindings, Variables } from 'types'
import healthRoutes from 'routes/health'
import authRoutes from 'routes/auth'
import mediaRouter from 'routes/media'

const app = new Hono<{
  Bindings: Bindings
  Variables: Variables
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

app.route('/', healthRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/media', mediaRouter)
app.onError(errorHandler)

export default app
