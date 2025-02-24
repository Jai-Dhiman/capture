import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { ApolloServer } from '@apollo/server'
import { startServerAndCreateCloudflareWorkersHandler } from '@as-integrations/cloudflare-workers'
import { typeDefs } from 'graphql/schema'
import { resolvers } from 'graphql/resolvers'
import { errorHandler } from 'middleware/errorHandler'
import { authMiddleware } from 'middleware/auth'
import type { Bindings, Variables } from 'types'
import healthRoutes from 'routes/health'
import mediaRouter from 'routes/media'

const app = new Hono<{
  Bindings: Bindings
  Variables: Variables
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

// GraphQL
const server = new ApolloServer({
  typeDefs,
  resolvers,
})

type ContextType = {
  env: Bindings
  user: any
}

const handler = startServerAndCreateCloudflareWorkersHandler<ContextType>(server, {
  context: async ({ request, ctx }) => {
    return {
      env: ctx.env,
      user: ctx.user,
    }
  },
})

app.use('/graphql', authMiddleware, async (c) => {
  const response = await handler(
    c.req.raw,
    {
      env: c.env,
      user: c.get('user'),
    },
    c
  )
  return response
})

// Public routes
app.route('/', healthRoutes)

// Protected routes
app.use('/api/*', authMiddleware)
app.route('/api/media', mediaRouter)

app.onError(errorHandler)

export default app
