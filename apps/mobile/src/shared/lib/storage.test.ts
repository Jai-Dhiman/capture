import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('secure-val'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  return {
    getItem: jest.fn().mockResolvedValue('async-val'),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  };
});

describe('secureStorage', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('uses SecureStore by default (native)', async () => {
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    let secureStorage: any;
    jest.isolateModules(() => {
      ({ secureStorage } = require('./storage'));
    });
    await secureStorage.setItem('k', 'v');
    const v = await secureStorage.getItem('k');
    expect(v).toBe('secure-val');
  });

  it('uses AsyncStorage on web', async () => {
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
    let secureStorage: any;
    jest.isolateModules(() => {
      ({ secureStorage } = require('./storage'));
    });
    await secureStorage.setItem('k', 'v');
    const v = await secureStorage.getItem('k');
    expect(v).toBe('async-val');
  });
});