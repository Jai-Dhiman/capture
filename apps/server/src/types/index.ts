import type { Queue } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  IMAGE_STORAGE: R2Bucket;
  KV: KVNamespace;
  REFRESH_TOKEN_KV: KVNamespace;
  Capture_Rate_Limits: KVNamespace;
  POST_VECTORS: KVNamespace;
  USER_VECTORS: KVNamespace;
  METADATA_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_ACCOUNT_HASH: string;
  CLOUDFLARE_IMAGES_TOKEN: string;
  CLOUDFLARE_IMAGES_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ENDPOINT: string;
  SEED_SECRET: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_ID_IOS: string;
  GOOGLE_CLIENT_SECRET: string;
  APPLE_CLIENT_ID: string;
  APPLE_CLIENT_SECRET: string;
  QDRANT_URL: string;
  QDRANT_API_KEY: string;
  QDRANT_COLLECTION_NAME: string;
  VOYAGE_API_KEY: string;
  POST_QUEUE: Queue<{ postId: string }>;
  USER_VECTOR_QUEUE: Queue<{ userId: string }>;
};

export interface AppUser {
  id: string;
  email?: string;
}

export type Variables = {
  user: AppUser;
};

export type ContextType = {
  env: Bindings;
  user: AppUser;
};
