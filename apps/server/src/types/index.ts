import type { User } from '@supabase/supabase-js';
import type { Ai, Queue } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  KV: KVNamespace;
  Capture_Rate_Limits: KVNamespace;
  POST_VECTORS: KVNamespace;
  VECTORIZE: VectorizeIndex;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_ACCOUNT_HASH: string;
  CLOUDFLARE_IMAGES_TOKEN: string;
  CLOUDFLARE_IMAGES_KEY: string;
  SEED_SECRET: string;
  AI: Ai;
  POST_QUEUE: Queue<string>;
  USER_VECTOR_QUEUE: Queue<string>;
};

export type Variables = {
  user: User;
};

export type ContextType = {
  env: Bindings;
  user: any;
};
