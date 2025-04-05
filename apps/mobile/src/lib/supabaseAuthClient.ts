import { createClient } from "@supabase/supabase-js";
import { secureStorage } from "./storage";
import { SUPABASE_URL, SUPABASE_ANON_PUBLIC } from "@env";

export const supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_PUBLIC, {
  auth: {
    flowType: "pkce",
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const getStoredCodeVerifier = async () => {
  try {
    return await secureStorage.getItem("supabase.auth.code_verifier");
  } catch (error) {
    console.error("Failed to retrieve code verifier:", error);
    return null;
  }
};
