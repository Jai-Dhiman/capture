import type { Context } from 'hono';

export const errorHandler = (err: Error, c: Context) => {
  const sentry = c.get('sentry');
  if (sentry) {
    sentry.captureException(err);
  }

  console.error(`[ERROR] ${err.message}`, err);

  return c.json(
    {
      error: c.env.ENV === 'production' ? 'Internal Server Error' : err.message,
    },
    500,
  );
};
