import type { SupabaseClient } from "@supabase/supabase-js";
import type { Draw } from "../engine/types";
import {
  isCovered,
  targetDigitsOf,
  targetPositionsFor,
} from "../movement/helpers";
import {
  isMovementOutputType,
  isMovementTarget,
  type MovementOutputType,
  type MovementResult,
  type MovementTarget,
} from "../movement/types";

export type AdaptivePredictionSource = "movement" | "batch_primary" | "batch_secondary";

export interface PendingAdaptivePrediction {
  id: string;
  source_result: string;
  source_history_size: number;
  output_type: MovementOutputType;
  target: MovementTarget;
  selected_digits: number[];
}

export type AdaptiveSettlement =
  | { status: "waiting" }
  | { status: "invalidated"; reason: string }
  | { status: "settled"; actualResult: Draw; isHit: boolean };

function normalizeStoredDigits(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(Number)
    .filter((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9))]
    .sort((left, right) => left - right);
}

export function adaptivePredictionKey(
  marketId: string,
  result: Pick<MovementResult, "latestDraw" | "selectedMethod" | "selectedWindow" | "config">,
): string {
  return JSON.stringify([
    marketId,
    result.config.sourceDataSize,
    result.latestDraw,
    result.config.outputType,
    result.config.target,
    result.config.digitCount,
    result.selectedMethod,
    result.selectedWindow,
  ]);
}

export function resolveAdaptiveSettlement(
  prediction: PendingAdaptivePrediction,
  draws: Draw[],
): AdaptiveSettlement {
  const sourceSize = Number(prediction.source_history_size);
  if (!Number.isInteger(sourceSize) || sourceSize < 1) {
    return { status: "invalidated", reason: "source_history_size tidak valid" };
  }
  if (draws.length <= sourceSize) return { status: "waiting" };

  const expectedSource = draws[sourceSize - 1];
  if (expectedSource !== prediction.source_result) {
    return {
      status: "invalidated",
      reason: `History berubah pada sumber prediksi: expected ${prediction.source_result}, found ${expectedSource ?? "none"}`,
    };
  }
  if (!isMovementOutputType(prediction.output_type) || !isMovementTarget(prediction.target)) {
    return { status: "invalidated", reason: "Konfigurasi output atau target tidak valid" };
  }

  const selectedDigits = normalizeStoredDigits(prediction.selected_digits);
  if (!selectedDigits.length) {
    return { status: "invalidated", reason: "selected_digits kosong atau tidak valid" };
  }

  const actualResult = draws[sourceSize];
  if (!/^\d{4}$/.test(actualResult ?? "")) {
    return { status: "invalidated", reason: "Result aktual berikutnya tidak valid" };
  }

  const positions = targetPositionsFor(prediction.output_type, prediction.target);
  const targetDigits = targetDigitsOf(actualResult, positions);
  return {
    status: "settled",
    actualResult,
    isHit: isCovered(selectedDigits, targetDigits, prediction.output_type),
  };
}

export async function settleAdaptivePredictions(
  supabase: SupabaseClient,
  marketId: string,
  draws: Draw[],
): Promise<{ settled: number; invalidated: number }> {
  const { data, error } = await supabase
    .from("adaptive_predictions")
    .select("id, source_result, source_history_size, output_type, target, selected_digits")
    .eq("market_id", marketId)
    .eq("status", "pending")
    .lt("source_history_size", draws.length);

  if (error) throw error;

  let settled = 0;
  let invalidated = 0;
  for (const raw of data ?? []) {
    const prediction = raw as PendingAdaptivePrediction;
    const resolution = resolveAdaptiveSettlement(prediction, draws);
    if (resolution.status === "waiting") continue;

    const patch = resolution.status === "settled"
      ? {
          status: "settled",
          actual_result: resolution.actualResult,
          is_hit: resolution.isHit,
          settlement_error: null,
          settled_at: new Date().toISOString(),
        }
      : {
          status: "invalidated",
          actual_result: null,
          is_hit: null,
          settlement_error: resolution.reason,
          settled_at: new Date().toISOString(),
        };

    const { error: updateError } = await supabase
      .from("adaptive_predictions")
      .update(patch)
      .eq("id", prediction.id)
      .eq("status", "pending");

    if (updateError) throw updateError;
    if (resolution.status === "settled") settled += 1;
    else invalidated += 1;
  }

  return { settled, invalidated };
}

export async function recordAdaptivePrediction(
  supabase: SupabaseClient,
  marketId: string,
  result: MovementResult,
  requestSource: AdaptivePredictionSource,
): Promise<boolean> {
  const row = {
    prediction_key: adaptivePredictionKey(marketId, result),
    market_id: marketId,
    request_source: requestSource,
    source_result: result.latestDraw,
    source_history_size: result.config.sourceDataSize,
    output_type: result.config.outputType,
    target: result.config.target,
    digit_count: result.config.digitCount,
    selected_digits: result.digits,
    selected_method: result.selectedMethod,
    selected_window: result.selectedWindow,
    l14_hit: result.evaluation.l14.hit,
    l14_total: result.evaluation.l14.total,
    selection_hit: result.selectionValidation.hit,
    selection_total: result.selectionValidation.total,
    confidence: result.confidence,
    strength: result.strength,
    regime: result.regime,
    tie_break_status: result.tieBreakStatus,
    candidate_count: result.config.candidateCount,
    probabilities: result.probabilities,
    status: "pending",
  };

  const { data, error } = await supabase
    .from("adaptive_predictions")
    .upsert(row, { onConflict: "prediction_key", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function settleAdaptivePredictionsSafely(
  supabase: SupabaseClient,
  marketId: string,
  draws: Draw[],
): Promise<void> {
  try {
    await settleAdaptivePredictions(supabase, marketId, draws);
  } catch (error) {
    console.error("[adaptive-ledger] Settlement error", { marketId, error });
  }
}

export async function recordAdaptivePredictionSafely(
  supabase: SupabaseClient,
  marketId: string,
  result: MovementResult,
  requestSource: AdaptivePredictionSource,
): Promise<void> {
  try {
    await recordAdaptivePrediction(supabase, marketId, result, requestSource);
  } catch (error) {
    console.error("[adaptive-ledger] Record error", { marketId, requestSource, error });
  }
}
