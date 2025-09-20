import { describe, expect, it, beforeEach, jest } from '@jest/globals';

// SecureStore/AsyncStorage are mocked in jest.setup.ts

describe('authStore logic', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('sets stage to profileRequired when profile does not exist', () => {
    const { useAuthStore } = require('@/features/auth/stores/authStore');
    const { setAuthData } = useAuthStore.getState();
    setAuthData({
      user: { id: 'u1', email: 'a@example.com' },
      session: { access_token: 't', refresh_token: 'r', expires_at: Date.now() + 3600_000 },
      profileExists: false,
      securitySetupRequired: false,
    });
    expect(useAuthStore.getState().stage).toBe('profileRequired');
  });

  it('sets stage to securitySetupRequired when security setup is required', () => {
    const { useAuthStore } = require('@/features/auth/stores/authStore');
    const { setAuthData } = useAuthStore.getState();
    setAuthData({
      user: { id: 'u2', email: 'b@example.com' },
      session: { access_token: 't2', refresh_token: 'r2', expires_at: Date.now() + 3600_000 },
      profileExists: true,
      securitySetupRequired: true,
    });
    expect(useAuthStore.getState().stage).toBe('securitySetupRequired');
  });

  it('sets stage to authenticated when profile exists and security setup is not required', () => {
    const { useAuthStore } = require('@/features/auth/stores/authStore');
    const { setAuthData } = useAuthStore.getState();
    setAuthData({
      user: { id: 'u3', email: 'c@example.com' },
      session: { access_token: 't3', refresh_token: 'r3', expires_at: Date.now() + 3600_000 },
      profileExists: true,
      securitySetupRequired: false,
    });
    expect(useAuthStore.getState().stage).toBe('authenticated');
  });
});
