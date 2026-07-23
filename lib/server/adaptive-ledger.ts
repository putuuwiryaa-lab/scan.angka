import type { SupabaseClient } from "@supabase/supabase-js";
import type { Draw } from "../engine/types";
import {
  isCovered,
  targetDigitsOf,
  targetPositionsFor,
} from "../movement/helpers";
import type { MovementShadowPrediction } from "../movement/shadow";
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

interface StoredAdaptivePrediction {
  id: string;
  status: "pending" | "settled" | "invalidated";
  actual_result: Draw | null;
  output_type: MovementOutputType;
  target: MovementTarget;
}

interface PendingShadowCandidate {
  id: string;
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

function isPredictionHit(
  outputType: MovementOutputType,
  target: MovementTarget,
  selectedDigits: unknown,
  actualResult: Draw,
): boolean | null {
  const digits = normalizeStoredDigits(selectedDigits);
  if (!digits.length || !/^\d{4}$/.test(actualResult)) return null;
  const targetDigits = targetDigitsOf(actualResult, targetPositionsFor(outputType, target));
  return isCovered(digits, targetDigits, outputType);
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

  const actualResult = draws[sourceSize];
  const isHit = isPredictionHit(
    prediction.output_type,
    prediction.target,
    prediction.selected_digits,
    actualResult,
  );
  if (isHit === null) {
    return { status: "invalidated", reason: "Result aktual atau selected_digits tidak valid" };
  }

  return { status: "settled", actualResult, isHit };
}

async function settleShadowCandidates(
  supabase: SupabaseClient,
  predictionId: string,
  outputType: MovementOutputType,
  target: MovementTarget,
  actualResult: Draw,
): Promise<number> {
  const { data, error } = await supabase
    .from("adaptive_prediction_candidates")
    .select("id, selected_digits")
    .eq("prediction_id", predictionId)
    .is("is_hit", null);

  if (error) throw error;

  let settled = 0;
  for (const raw of data ?? []) {
    const candidate = raw as PendingShadowCandidate;
    const isHit = isPredictionHit(outputType, target, candidate.selected_digits, actualResult);
    if (isHit === null) continue;
    const { error: updateError } = await supabase
      .from("adaptive_prediction_candidates")
      .update({ is_hit: isHit })
      .eq("id", candidate.id)
      .is("is_hit", null);
    if (updateError) throw updateError;
    settled += 1;
  }
  return settled;
}

export async function settleAdaptivePredictions(
  supabase: SupabaseClient,
  marketId: string,
  draws: Draw[],
): Promise<{ settled: number; invalidated: number; shadowSettled: number }> {
  const { data, error } = await supabase
    .from("adaptive_predictions")
    .select("id, source_result, source_history_size, output_type, target, selected_digits")
    .eq("market_id", marketId)
    .eq("status", "pending")
    .lt("source_history_size", draws.length);

  if (error) throw error;

  let settled = 0;
  let invalidated = 0;
  let shadowSettled = 0;
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
    if (resolution.status === "settled") {
      settled += 1;
      shadowSettled += await settleShadowCandidates(
        supabase,
        prediction.id,
        prediction.output_type,
        prediction.target,
        resolution.actualResult,
      );
    } else {
      invalidated += 1;
    }
  }

  return { settled, invalidated, shadowSettled };
}

async function findAdaptivePrediction(
  supabase: SupabaseClient,
  predictionKey: string,
): Promise<StoredAdaptivePrediction | null> {
  const { data, error } = await supabase
    .from("adaptive_predictions")
    .select("id, status, actual_result, output_type, target")
    .eq("prediction_key", predictionKey)
    .maybeSingle();
  if (error) throw error;
  return data as StoredAdaptivePrediction | null;
}

async function ensureAdaptivePrediction(
  supabase: SupabaseClient,
  marketId: string,
  result: MovementResult,
  requestSource: AdaptivePredictionSource,
): Promise<{ prediction: StoredAdaptivePrediction; created: boolean }> {
  const predictionKey = adaptivePredictionKey(marketId, result);
  const existing = await findAdaptivePrediction(supabase, predictionKey);
  if (existing) return { prediction: existing, created: false };

  const row = {
    prediction_key: predictionKey,
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
    .insert(row)
    .select("id, status, actual_result, output_type, target")
    .single();

  if (!error) return { prediction: data as StoredAdaptivePrediction, created: true };
  if ((error as { code?: string }).code !== "23505") throw error;

  const raced = await findAdaptivePrediction(supabase, predictionKey);
  if (!raced) throw error;
  return { prediction: raced, created: false };
}

async function recordShadowPredictions(
  supabase: SupabaseClient,
  prediction: StoredAdaptivePrediction,
  result: MovementResult,
  shadows: MovementShadowPrediction[],
): Promise<void> {
  if (!shadows.length) return;
  const rows = shadows.map((shadow) => ({
    prediction_id: prediction.id,
    initial_rank: shadow.initialRank,
    method: shadow.method,
    window: shadow.window,
    selected_digits: shadow.digits,
    probabilities: shadow.probabilities,
    selection_score: shadow.selectionScore,
    runner_up_score: shadow.runnerUpScore,
    margin: shadow.margin,
    l14_hit: shadow.evaluation.hit,
    l14_total: shadow.evaluation.total,
    l7_hit: shadow.l7Hit,
    l3_hit: shadow.l3Hit,
    mean_probability: shadow.meanProbability,
    is_selected: shadow.method === result.selectedMethod && shadow.window === result.selectedWindow,
  }));

  const { error } = await supabase
    .from("adaptive_prediction_candidates")
    .upsert(rows, {
      onConflict: "prediction_id,method,window",
      ignoreDuplicates: true,
    });
  if (error) throw error;

  if (prediction.status === "settled" && prediction.actual_result) {
    await settleShadowCandidates(
      supabase,
      prediction.id,
      prediction.output_type,
      prediction.target,
      prediction.actual_result,
    );
  }
}

export async function recordAdaptivePrediction(
  supabase: SupabaseClient,
  marketId: string,
  result: MovementResult,
  requestSource: AdaptivePredictionSource,
  shadows: MovementShadowPrediction[] = [],
): Promise<boolean> {
  const ensured = await ensureAdaptivePrediction(supabase, marketId, result, requestSource);
  await recordShadowPredictions(supabase, ensured.prediction, result, shadows);
  return ensured.created;
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
  shadows: MovementShadowPrediction[] = [],
): Promise<void> {
  try {
    await recordAdaptivePrediction(supabase, marketId, result, requestSource, shadows);
  } catch (error) {
    console.error("[adaptive-ledger] Record error", { marketId, requestSource, error });
  }
}
