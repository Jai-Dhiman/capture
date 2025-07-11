import { resolvers } from '@/graphql/resolvers';
import { typeDefs } from '@/graphql/schema';
import { authMiddleware } from '@/middleware/auth';
import { errorHandler } from '@/middleware/errorHandler';
import { securityHeaders, sslRedirectMiddleware } from '@/middleware/security';
import authRouter from '@/routes/auth';
import cacheRouter from '@/routes/cache';
import deeplinkRouter from '@/routes/deeplink';
import healthRoutes from '@/routes/health';
import interestsRouter from '@/routes/interests';
import mediaRouter from '@/routes/media';
import profileRouter from '@/routes/profile';
import { handlePostQueue, handleUserEmbeddingQueue } from '@/routes/queues';
import seedRouter from '@/routes/seed';
import type { Bindings, ContextType, Variables } from '@/types';
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateCloudflareWorkersHandler } from '@as-integrations/cloudflare-workers';
import type { ExecutionContext, MessageBatch } from '@cloudflare/workers-types';
import { sentry } from '@hono/sentry';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use('*', logger());
app.use('*', sentry());
app.use('*', sslRedirectMiddleware());
app.use('*', securityHeaders());
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:8081',
      'http://localhost:8787',
      'http://localhost:19000',
      'http://localhost:19006',
      'http://localhost:8969/stream',
      'https://o4509049381519360.ingest.us.sentry.io/api/4509049386434560/envelope/?sentry_key=74904d3bf1ebb2b0747f5356b0a83624&sentry_version=7&sentry_client=sentry.javascript.react-native%2F6.3.0.',
      'exp://*',
      'https://*.exp.direct',
      'https://capture-api.jai-d.workers.dev',
      'https://cdn.capture-app.com',
    ],
    allowHeaders: ['Content-Type', 'Authorization', 'sentry-trace', 'baggage'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
);

// GraphQL
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const handler = startServerAndCreateCloudflareWorkersHandler(server, {
  context: async ({ ctx }) => {
    const contextValue = (ctx as any).props as ContextType;
    return contextValue;
  },
});

app.use('/graphql', authMiddleware, async (c) => {
  const contextValue: ContextType = {
    env: c.env,
    user: c.get('user'),
  };

  const response = await handler(c.req.raw, contextValue, {
    waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
    passThroughOnException: c.executionCtx.passThroughOnException.bind(c.executionCtx),
    props: contextValue,
  });
  return response;
});

// Apple App Site Association for passkeys
app.get('/.well-known/apple-app-site-association', (c) => {
  const aasa = {
    webcredentials: {
      apps: ['J2C869U2JJ.com.obscuratechnologies.capture'],
    },
    applinks: {
      apps: [],
      details: [],
    },
  };

  c.header('Content-Type', 'application/json');
  return c.json(aasa);
});

// Public routes
app.route('/', healthRoutes);
app.route('/auth', authRouter);
app.route('/seed', seedRouter);

// Protected routes
app.use('/api/*', authMiddleware);

app.route('/api/cache', cacheRouter);
app.route('/api/media', mediaRouter);
app.route('/api/profile', profileRouter);
app.route('/api/interests', interestsRouter);
app.route('/api/deeplink', deeplinkRouter);

app.onError(errorHandler);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<any>, env: Bindings): Promise<void> {
    switch (batch.queue) {
      case 'post-queue':
        await handlePostQueue(batch, env);
        break;
      case 'user-vector-queue':
        await handleUserEmbeddingQueue(batch, env);
        break;
      default:
        console.error(`Received message for unknown queue: ${batch.queue}`);
        // Acknowledge messages from unknown queues to prevent retries
        batch.ackAll();
        break;
    }
  },
};
