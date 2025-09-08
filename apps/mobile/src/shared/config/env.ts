import Constants from 'expo-constants';

// Import from @env with proper fallbacks for web builds
let API_URL_ENV: string | undefined;
let SHARE_URL_ENV: string | undefined;

try {
  // This might fail in web builds, so wrap in try-catch
  const envModule = require('@env');
  API_URL_ENV = envModule.API_URL;
  SHARE_URL_ENV = envModule.SHARE_URL;
} catch (error) {
  console.warn('Failed to load @env module, using fallbacks:', error);
}

// Centralized configuration with proper fallbacks
export const ENV_CONFIG = {
  API_URL: 
    API_URL_ENV || 
    Constants.expoConfig?.extra?.API_URL || 
    process.env.API_URL ||
    'https://capture-api.jai-d.workers.dev',
    
  SHARE_URL: 
    SHARE_URL_ENV || 
    Constants.expoConfig?.extra?.SHARE_URL || 
    process.env.SHARE_URL ||
    'https://www.captureapp.org',
};

// Export individual values for backward compatibility
export const API_URL = ENV_CONFIG.API_URL;
export const SHARE_URL = ENV_CONFIG.SHARE_URL;

console.log('[ENV_CONFIG] Loaded configuration:', {
  API_URL: ENV_CONFIG.API_URL,
  SHARE_URL: ENV_CONFIG.SHARE_URL,
  source: API_URL_ENV ? '@env' : 'fallback',
});