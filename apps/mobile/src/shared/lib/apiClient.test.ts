import { describe, expect, it, jest, beforeEach } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn();
(global as any).fetch = mockFetch as any;

const mockStoreModulePath = '@/features/auth/stores/authStore';

describe('apiClient', () => {
  beforeEach(() => {
    jest.resetModules();
    mockFetch.mockReset();
  });

  it('throws when auth is required and no token is present', async () => {
    jest.doMock(mockStoreModulePath, () => ({
      useAuthStore: { getState: () => ({ session: null, refreshSession: jest.fn() }) },
    }));

    let apiClient: any;
    jest.isolateModules(() => {
      ({ apiClient } = require('@/shared/lib/apiClient'));
    });
    await expect(apiClient.get('/api/protected', true)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('propagates server error message', async () => {
    jest.doMock(mockStoreModulePath, () => ({
      useAuthStore: {
        getState: () => ({ session: { access_token: 'T', expires_at: Date.now() + 3600_000 }, refreshSession: jest.fn() }),
      },
    }));

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Boom' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as any,
    );

    let apiClient: any;
    jest.isolateModules(() => {
      ({ apiClient } = require('@/shared/lib/apiClient'));
    });
    await expect(apiClient.get('/api/fail', true)).rejects.toMatchObject({ message: 'Boom' });
  });
  it('retries once after failed refresh and succeeds', async () => {
    jest.useFakeTimers();

    const refreshMock = jest
      .fn()
      .mockResolvedValueOnce(null) // first attempt returns null
      .mockResolvedValueOnce({ access_token: 'NEW', expires_at: Date.now() + 3600_000 }); // second attempt

    jest.doMock(mockStoreModulePath, () => ({
      useAuthStore: {
        getState: () => ({
          session: { access_token: 'OLD', expires_at: Date.now() + 1_000 }, // expiring soon
          refreshSession: refreshMock,
        }),
      },
    }));

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as any,
    );

    let apiClient: any;
    jest.isolateModules(() => {
      ({ apiClient } = require('@/shared/lib/apiClient'));
    });

    const promise = apiClient.get('/api/ok', true);

    // Advance timers to allow retry delay (500ms)
    await Promise.resolve();
    jest.advanceTimersByTime(500);

    const res = await promise;

    expect(refreshMock).toHaveBeenCalledTimes(2);
    const [, calledInit] = mockFetch.mock.calls[0];
    expect((calledInit as any).headers.Authorization).toBe('Bearer NEW');
    expect(res).toEqual({ ok: true });

    jest.useRealTimers();
  });
});
