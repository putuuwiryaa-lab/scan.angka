import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MOVEMENT_METHODS,
  type MovementConfig,
  type MovementMethod,
} from "../movement/types";
import type { AdaptiveLiveModelWeight } from "../movement/persistent-live";

interface StoredWeightRow {
  method: unknown;
  window: unknown;
  decayed_hits: unknown;
  decayed_total: unknown;
  observations: unknown;
}

function isMovementMethod(value: unknown): value is MovementMethod {
  return MOVEMENT_METHODS.includes(value as MovementMethod);
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function refreshAdaptiveLiveWeights(
  supabase: SupabaseClient,
  marketId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "refresh_adaptive_live_weights_for_market",
    {
      p_market_id: marketId,
      p_decay: 0.97,
    },
  );
  if (error) throw error;
  return Math.max(0, Math.trunc(finiteNumber(data)));
}

export async function loadAdaptiveLiveWeights(
  supabase: SupabaseClient,
  marketId: string,
  config: MovementConfig,
): Promise<AdaptiveLiveModelWeight[]> {
  await refreshAdaptiveLiveWeights(supabase, marketId);

  const { data, error } = await supabase
    .from("adaptive_live_model_weights")
    .select("method, window, decayed_hits, decayed_total, observations")
    .eq("market_id", marketId)
    .eq("output_type", config.outputType)
    .eq("target", config.target)
    .eq("digit_count", config.digitCount);

  if (error) throw error;

  return (data ?? []).flatMap((raw) => {
    const row = raw as StoredWeightRow;
    const method = row.method;
    const window = Math.trunc(finiteNumber(row.window));
    const observations = Math.max(0, Math.trunc(finiteNumber(row.observations)));
    if (!isMovementMethod(method) || window < 14) return [];
    return [{
      method,
      window,
      decayedHits: Math.max(0, finiteNumber(row.decayed_hits)),
      decayedTotal: Math.max(0, finiteNumber(row.decayed_total)),
      observations,
    }];
  });
}

export async function loadAdaptiveLiveWeightsSafely(
  supabase: SupabaseClient,
  marketId: string,
  config: MovementConfig,
): Promise<AdaptiveLiveModelWeight[]> {
  try {
    return await loadAdaptiveLiveWeights(supabase, marketId, config);
  } catch (error) {
    console.error("[adaptive-live-weights] Load error", { marketId, config, error });
    return [];
  }
}
