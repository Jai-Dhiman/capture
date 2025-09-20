import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn();
(global as any).fetch = mockFetch as any;

const mockStoreModulePath = '@/features/auth/stores/authStore';

describe('graphqlClient', () => {
  beforeEach(() => {
    jest.resetModules();
    mockFetch.mockReset();
  });

  it('adds Authorization header and posts to /graphql', async () => {
    // Provide an access token
    jest.doMock(mockStoreModulePath, () => ({
      useAuthStore: {
        getState: () => ({
          session: { access_token: 'TOKEN', expires_at: Date.now() + 60_000 },
          refreshSession: jest.fn(),
        }),
      },
    }));

    // Mock successful GraphQL response
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as any,
    );

    let graphqlFetch: any;
    jest.isolateModules(() => {
      ({ graphqlFetch } = require('@/shared/lib/graphqlClient'));
    });

    const res = await graphqlFetch({ query: '{ __typename }' });
    expect(res).toEqual({ ok: true });

    // Verify URL and headers
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(String(calledUrl)).toMatch(/\/graphql$/);
    expect((calledInit as any).headers.Authorization).toBe('Bearer TOKEN');
  });

  it('refreshes token if expiring soon', async () => {
    const refreshMock = jest.fn().mockResolvedValue({ access_token: 'NEW', expires_at: Date.now() + 3600_000 });

    jest.doMock(mockStoreModulePath, () => ({
      useAuthStore: {
        getState: () => ({
          session: { access_token: 'OLD', expires_at: Date.now() + 10_000 }, // expiring soon
          refreshSession: refreshMock,
        }),
      },
    }));

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { pong: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as any,
    );

    let graphqlFetch: any;
    jest.isolateModules(() => {
      ({ graphqlFetch } = require('@/shared/lib/graphqlClient'));
    });
    const data = await graphqlFetch({ query: 'query P { ping }' });

    expect(refreshMock).toHaveBeenCalled();
    const [, calledInit] = mockFetch.mock.calls[0];
    expect((calledInit as any).headers.Authorization).toBe('Bearer NEW');
    expect(data).toEqual({ pong: true });
  });

  it('throws when HTTP status is not ok', async () => {
    jest.doMock(mockStoreModulePath, () => ({
      useAuthStore: {
        getState: () => ({
          session: { access_token: 'T', expires_at: Date.now() + 3600_000 },
          refreshSession: jest.fn(),
        }),
      },
    }));

    mockFetch.mockResolvedValueOnce(new Response('nope', { status: 500 }) as any);

    let graphqlFetch: any;
    jest.isolateModules(() => {
      ({ graphqlFetch } = require('@/shared/lib/graphqlClient'));
    });
    await expect(graphqlFetch({ query: '{ x }' })).rejects.toThrow(/HTTP 500/);
  });
});