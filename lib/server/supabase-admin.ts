import { createClient } from "@supabase/supabase-js";
import { requireAnyEnv, requireEnv } from "./env";

export function createAdminClient() {
  return createClient(
    requireAnyEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
