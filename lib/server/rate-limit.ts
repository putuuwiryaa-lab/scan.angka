import { createAdminClient } from "./supabase-admin";

type RateLimitRow = {
  allowed: boolean;
  retry_after_seconds: number | string | null;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

type ConsumeRateLimitOptions = {
  scope: string;
  keyHash: string;
  limit: number;
  windowSeconds: number;
  blockSeconds: number;
};

export async function consumeRateLimit({
  scope,
  keyHash,
  limit,
  windowSeconds,
  blockSeconds,
}: ConsumeRateLimitOptions): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("consume_access_rate_limit", {
    p_scope: scope,
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("Invalid rate-limit response.");
  }

  return {
    allowed: row.allowed,
    retryAfter: Math.max(0, Number(row.retry_after_seconds) || 0),
  };
}

export async function clearRateLimit(scope: string, keyHash: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("access_rate_limits")
    .delete()
    .eq("scope", scope)
    .eq("key_hash", keyHash);

  if (error) throw error;
}
