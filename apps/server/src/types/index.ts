import type { User } from "@supabase/supabase-js";

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  KV: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_ACCOUNT_HASH: string;
  CLOUDFLARE_IMAGES_TOKEN: string;
  CLOUDFLARE_IMAGES_KEY: string;
};

export type Variables = {
  user: User;
};

export type ContextType = {
  env: Bindings;
  user: any;
};
