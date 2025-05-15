import { createClient } from "@supabase/supabase-js";
import { secureStorage } from "@shared/lib/storage";
import { SUPABASE_URL, SUPABASE_ANON_PUBLIC } from "@env";

const customStorageAdapter = {
  getItem: async (key: string) => {
    const value = await secureStorage.getItem(key);
    return value;
  },
  setItem: async (key: string, value: string) => {
    return secureStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    return secureStorage.removeItem(key);
  },
};

export const supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_PUBLIC, {
  auth: {
    flowType: "pkce",
    storage: customStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const getStoredCodeVerifier = async () => {
  try {
    const verifier = await secureStorage.getItem("sb-cksprfmynsulsqecwngc-auth-token-code-verifier");
    return verifier;
  } catch (error) {
    console.error("Failed to retrieve code verifier:", error);
    return null;
  }
};
