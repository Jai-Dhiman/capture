import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('@/shared/lib/apiClient', () => ({
  apiClient: {
    post: (...args: any[]) => mockPost(...args),
    get: (...args: any[]) => mockGet(...args),
  },
}));

describe('workersAuthApi', () => {
  beforeEach(() => {
    jest.resetModules();
    mockPost.mockReset();
    mockGet.mockReset();
  });

  it('calls correct endpoints for sendCode and verifyCode', async () => {
    mockPost.mockResolvedValueOnce({ ok: true });
    mockPost.mockResolvedValueOnce({ session: { access_token: 't' }, user: { id: 'u' } });

    let workersAuthApi: any;
    jest.isolateModules(() => {
      ({ workersAuthApi } = require('./workersAuthApi'));
    });

    await workersAuthApi.sendCode({ email: 'a@example.com' });
    await workersAuthApi.verifyCode({ email: 'a@example.com', code: '123456' });

    expect(mockPost).toHaveBeenNthCalledWith(1, '/auth/send-code', { email: 'a@example.com' }, false);
    expect(mockPost).toHaveBeenNthCalledWith(2, '/auth/verify-code', { email: 'a@example.com', code: '123456' }, false);
  });

  it('refresh uses refresh token body', async () => {
    mockPost.mockResolvedValueOnce({ session: { access_token: 'new' }, user: { id: 'u' } });
    let workersAuthApi: any;
    jest.isolateModules(() => {
      ({ workersAuthApi } = require('./workersAuthApi'));
    });
    await workersAuthApi.refresh('REFRESH');
    expect(mockPost).toHaveBeenCalledWith('/auth/refresh', { refresh_token: 'REFRESH' }, false);
  });

  it('oauthGoogleToken posts idToken', async () => {
    mockPost.mockResolvedValueOnce({ session: { access_token: 'g' }, user: { id: 'u' } });
    let workersAuthApi: any;
    jest.isolateModules(() => {
      ({ workersAuthApi } = require('./workersAuthApi'));
    });
    await workersAuthApi.oauthGoogleToken('IDTOKEN');
    expect(mockPost).toHaveBeenCalledWith('/auth/oauth/google/token', { idToken: 'IDTOKEN' }, false);
  });

  it('getMe returns null on api error', async () => {
    mockGet.mockRejectedValueOnce(new Error('bad'));
    let workersAuthApi: any;
    jest.isolateModules(() => {
      ({ workersAuthApi } = require('./workersAuthApi'));
    });
    const res = await workersAuthApi.getMe();
    expect(res).toBeNull();
  });
});