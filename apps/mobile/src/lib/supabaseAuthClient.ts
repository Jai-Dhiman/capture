import { createClient } from "@supabase/supabase-js";
import { secureStorage } from "./storage";
import { SUPABASE_URL, SUPABASE_ANON_PUBLIC } from "@env";

const CODE_VERIFIER_KEY = "supabase.auth.code_verifier";

export const supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_PUBLIC, {
  auth: {
    flowType: "pkce",
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const getStoredCodeVerifier = async () => {
  try {
    return await secureStorage.getItem(CODE_VERIFIER_KEY);
  } catch (error) {
    console.error("Failed to retrieve code verifier:", error);
    return null;
  }
};
