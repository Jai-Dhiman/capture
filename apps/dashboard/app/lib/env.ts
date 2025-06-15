// This file makes env variables accessible from a centralized place
// It provides better error handling for missing values

export const env = {
  CLERK_PUBLISHABLE_KEY:
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    (import.meta.env.MODE === 'development' ? 'pk_test_dummy-key-for-dev' : ''),
  CLERK_SECRET_KEY: import.meta.env.VITE_CLERK_SECRET_KEY,
};

// Validate required values
if (!env.CLERK_PUBLISHABLE_KEY && import.meta.env.MODE === 'production') {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable');
}
