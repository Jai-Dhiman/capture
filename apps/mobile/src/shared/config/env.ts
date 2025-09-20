import Constants from 'expo-constants';

// Single source of truth for runtime configuration.
// We avoid using @env directly to prevent accidental silent fallbacks.
// In release builds, missing required keys will throw immediately.

function readExtra(key: string): string | undefined {
  // Expo/EAS injects public vars into expoConfig.extra and process.env
  const fromExtra = (Constants.expoConfig as any)?.extra?.[key];
  const fromProcess = (process?.env as any)?.[key];
  return (fromExtra ?? fromProcess ?? undefined) as string | undefined;
}

function requireKey(key: string, val: string | undefined): string {
  if (!val || String(val).trim().length === 0) {
    // Fail fast in release builds; warn in dev and test.
    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
    const isTest = process?.env?.NODE_ENV === 'test';
    if (isDev || isTest) {
      console.warn(`[ENV] Missing ${key}. Using empty string in ${isTest ? 'test' : 'development'}; release builds will fail.`);
      return '';
    }
    throw new Error(`[ENV] Missing required configuration key: ${key}`);
  }
  return String(val);
}

// Resolve all keys (prefix public web-exposed keys with EXPO_PUBLIC_ when appropriate)
const API_URL_RESOLVED = readExtra('API_URL') || readExtra('EXPO_PUBLIC_API_URL');
const SHARE_URL_RESOLVED = readExtra('SHARE_URL') || readExtra('EXPO_PUBLIC_SHARE_URL');
const SENTRY_DSN_RESOLVED = readExtra('EXPO_PUBLIC_SENTRY_DSN');
const GOOGLE_CLIENT_ID_RESOLVED = readExtra('EXPO_PUBLIC_GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_ID_IOS_RESOLVED = readExtra('EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS');
const APPLE_CLIENT_ID_RESOLVED = readExtra('EXPO_PUBLIC_APPLE_CLIENT_ID');

export const ENV_CONFIG = {
  API_URL: requireKey('EXPO_PUBLIC_API_URL', API_URL_RESOLVED || 'https://capture-api.jai-d.workers.dev'),
  SHARE_URL: requireKey('EXPO_PUBLIC_SHARE_URL', SHARE_URL_RESOLVED || 'https://www.captureapp.org'),
  SENTRY_DSN: requireKey('EXPO_PUBLIC_SENTRY_DSN', SENTRY_DSN_RESOLVED || ''),
  GOOGLE_CLIENT_ID: requireKey('EXPO_PUBLIC_GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID_RESOLVED || ''),
  GOOGLE_CLIENT_ID_IOS: requireKey('EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS', GOOGLE_CLIENT_ID_IOS_RESOLVED || ''),
  APPLE_CLIENT_ID: requireKey('EXPO_PUBLIC_APPLE_CLIENT_ID', APPLE_CLIENT_ID_RESOLVED || ''),
} as const;

// Individual exports for backward compatibility
export const API_URL = ENV_CONFIG.API_URL;
export const SHARE_URL = ENV_CONFIG.SHARE_URL;
export const SENTRY_DSN = ENV_CONFIG.SENTRY_DSN;
