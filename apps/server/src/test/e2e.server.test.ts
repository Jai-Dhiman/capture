import { describe, it, expect } from 'vitest';
import workerExport from '../index';

// Minimal Env and ExecutionContext stubs for Worker fetch
const makeEnv = (overrides: Record<string, any> = {}) => ({
  ENV: 'test',
  ...overrides,
});

const ctx = {
  waitUntil: (_p: Promise<any>) => {},
  passThroughOnException: () => {},
} as any;

const fetchWorker = async (input: RequestInfo, init?: RequestInit, envOverrides: Record<string, any> = {}) => {
  const req = new Request(typeof input === 'string' ? input : (input as Request).url, init);
  const env = makeEnv(envOverrides);
  const res = await (workerExport as any).fetch(req, env, ctx);
  return res as Response;
};

describe('Server E2E (Worker handler)', () => {
  it('GET /version returns env and build information', async () => {
    const res = await fetchWorker('http://localhost/version');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('env');
    expect(body).toHaveProperty('buildTime');
  });

  it('GET /.well-known/apple-app-site-association is served', async () => {
    const res = await fetchWorker('http://localhost/.well-known/apple-app-site-association');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('webcredentials');
  });

  it('POST /graphql rejects introspection queries (introspection disabled)', async () => {
    const query = {
      query: 'query IntrospectionQuery { __schema { types { name } } }',
      variables: {},
    };
    const res = await fetchWorker('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    // Apollo may return 400 or 200 with errors; accept either as long as it errors
    const statusIsError = res.status >= 400;
    let hasGraphQLErrors = false;
    try {
      const json = await res.clone().json();
      hasGraphQLErrors = Array.isArray(json.errors) && json.errors.length > 0;
    } catch {}

    expect(statusIsError || hasGraphQLErrors).toBe(true);
  });
});
