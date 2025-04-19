import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
  if (!platform?.env?.DB) {
    return json(
      {
        status: 'error',
        message: 'Database connection not available',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }

  try {
    // Simple query to check if database is responsive
    const startTime = performance.now();
    const result = await platform.env.DB.prepare('SELECT 1 as health').first();
    const endTime = performance.now();

    const responseTime = Math.round(endTime - startTime);

    if (result && result.health === 1) {
      return json({
        status: 'healthy',
        message: 'Database connection successful',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      });
    } else {
      return json(
        {
          status: 'error',
          message: 'Database returned unexpected result',
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Database health check failed:', error);

    return json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
};
