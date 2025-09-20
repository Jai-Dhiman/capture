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
});
