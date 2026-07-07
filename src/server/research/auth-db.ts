import { researchServerEnv } from "./env.js";
import { SupabaseRestClient } from "./supabase-rest.js";

const authSupabaseTimeoutMs = 6_000;

export const authSupabaseClient = (): SupabaseRestClient => {
  const env = researchServerEnv();
  return new SupabaseRestClient({
    retryLimit: 0,
    serviceRoleKey: env.supabaseServiceRoleKey,
    timeoutMs: authSupabaseTimeoutMs,
    url: env.supabaseUrl
  });
};
