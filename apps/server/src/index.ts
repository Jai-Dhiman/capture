import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { errorHandler } from 'middleware/errorHandler'
import { authMiddleware } from 'middleware/auth'
import type { Bindings } from 'types'
import healthRoutes from 'routes/health'
import mediaRouter from 'routes/media'

const app = new Hono<{
  Bindings: Bindings
}>()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:8081',
      'http://localhost:19000',
      'http://localhost:19006',
      'exp://*',
    ],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })
)

app.route('/', healthRoutes)

app.use('/api/*', authMiddleware)
app.route('/api/media', mediaRouter)
app.onError(errorHandler)

export default app
