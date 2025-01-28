import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { authMiddleware } from 'middleware/auth'
import { errorHandler } from 'middleware/errorHandler'
import healthRoutes from 'routes/health'
import authRoutes from 'routes/auth'

const app = new Hono<{}>()

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

// app.use('/api', authMiddleware)

app.route('/', healthRoutes)
app.route('/api/auth', authRoutes)

app.onError(errorHandler)

export default app
