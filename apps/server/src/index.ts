import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { ApolloServer } from '@apollo/server';
import { sentry } from '@hono/sentry';
import { startServerAndCreateCloudflareWorkersHandler } from '@as-integrations/cloudflare-workers';
import { typeDefs } from 'graphql/schema';
import { resolvers } from 'graphql/resolvers';
import { errorHandler } from 'middleware/errorHandler';
import { authMiddleware } from 'middleware/auth';
import type { Bindings, Variables, ContextType } from 'types';
import healthRoutes from 'routes/health';
import mediaRouter from 'routes/media';
import profileRouter from 'routes/profile';
import authRouter from 'routes/auth';
import seedRouter from 'routes/seed';
import recommendRouter from 'routes/recommend';

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use('*', logger());
app.use('*', sentry());
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:8081',
      'http://localhost:19000',
      'http://localhost:19006',
      'http://localhost:8969/stream',
      'https://o4509049381519360.ingest.us.sentry.io/api/4509049386434560/envelope/?sentry_key=74904d3bf1ebb2b0747f5356b0a83624&sentry_version=7&sentry_client=sentry.javascript.react-native%2F6.3.0.',
      'exp://*',
      'https://*.exp.direct',
      'https://capture-api.jai-d.workers.dev',
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

// Public routes
app.route('/', healthRoutes);
app.route('/auth', authRouter);
app.route('/seed', seedRouter);
app.get('/ai/test', async (c) => {
  const out = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
    prompt: '👋 Hello from Cloudflare AI!',
  });
  return c.json(out);
});

// Protected routes
app.use('/api/*', authMiddleware);
app.route('/api/media', mediaRouter);
app.route('/api/profile', profileRouter);
app.route('/api/recommend', recommendRouter);

app.onError(errorHandler);

export default app;
