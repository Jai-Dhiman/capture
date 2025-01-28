import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { createAuth } from 'lib/auth'
import { authMiddleware } from 'middleware/auth'
import { errorHandler } from 'middleware/errorHandler'
import healthRoutes from 'routes/health'
import authRoutes from 'routes/auth'

type Bindings = {
  DATABASE_URL: string
}

type Variables = {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}

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
app.onError(errorHandler)

export default app
