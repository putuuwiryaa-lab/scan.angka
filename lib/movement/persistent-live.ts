import { DIGITS } from "./helpers";
import type { MovementShadowPrediction } from "./shadow";
import type {
  MovementMethod,
  MovementProbability,
  MovementResult,
} from "./types";

export const PERSISTENT_LIVE_MIN_OBSERVATIONS = 8;
export const PERSISTENT_LIVE_FULL_OBSERVATIONS = 42;
export const PERSISTENT_LIVE_MAX_BLEND = 0.25;

export interface AdaptiveLiveModelWeight {
  method: MovementMethod;
  window: number;
  decayedHits: number;
  decayedTotal: number;
  observations: number;
}

export interface PersistentLiveSourceWeight {
  method: MovementMethod;
  window: number;
  observations: number;
  historicalRate: number;
  posteriorRate: number | null;
  reliability: number;
  normalizedWeight: number;
}

export interface PersistentLiveWeighting {
  applied: boolean;
  changedDigits: boolean;
  strength: number;
  eligibleSources: number;
  averageObservationDepth: number;
  selectedWindow: number;
  sourceWeights: PersistentLiveSourceWeight[];
}

export type PersistentlyWeightedMovementResult = MovementResult & {
  liveWeighting: PersistentLiveWeighting;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function candidateKey(method: MovementMethod, window: number): string {
  return `${method}:${window}`;
}

function normalizeVector(values: number[]): number[] {
  const positive = DIGITS.map((digit) => Math.max(0, values[digit] ?? 0));
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return DIGITS.map(() => 1 / DIGITS.length);
  return positive.map((value) => value / total);
}

function probabilityVector(probabilities: MovementProbability[]): number[] {
  const values = Array.from({ length: DIGITS.length }, () => 0);
  for (const item of probabilities) values[item.digit] = Math.max(0, item.score);
  return normalizeVector(values);
}

function probabilitiesFromVector(values: number[]): MovementProbability[] {
  const normalized = normalizeVector(values);
  return DIGITS.map((digit) => ({
    digit,
    score: Number((normalized[digit] * 100).toFixed(2)),
  })).sort((left, right) => right.score - left.score || left.digit - right.digit);
}

function posteriorRate(weight: AdaptiveLiveModelWeight | undefined): number | null {
  if (!weight || weight.decayedTotal <= 0 || weight.observations < 1) return null;
  return (weight.decayedHits + 1) / (weight.decayedTotal + 2);
}

function reliabilityOf(observations: number): number {
  if (observations < PERSISTENT_LIVE_MIN_OBSERVATIONS) return 0;
  const span = PERSISTENT_LIVE_FULL_OBSERVATIONS - PERSISTENT_LIVE_MIN_OBSERVATIONS + 1;
  return clamp((observations - PERSISTENT_LIVE_MIN_OBSERVATIONS + 1) / span, 0, 1);
}

function sameDigits(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((digit, index) => digit === right[index]);
}

export function applyPersistentLiveWeights(
  result: MovementResult,
  shadows: MovementShadowPrediction[],
  storedWeights: AdaptiveLiveModelWeight[],
): PersistentlyWeightedMovementResult {
  const sources = shadows.filter((shadow) =>
    shadow.window === result.selectedWindow && shadow.method !== "walk_forward_weighted",
  );
  const weightByKey = new Map(storedWeights.map((weight) => [
    candidateKey(weight.method, weight.window),
    weight,
  ]));

  const sourceStates = sources.map((source) => {
    const stored = weightByKey.get(candidateKey(source.method, source.window));
    const observations = stored?.observations ?? 0;
    const liveRate = posteriorRate(stored);
    const reliability = reliabilityOf(observations);
    const historicalRate = (source.evaluation.hit + 1) / (source.evaluation.total + 2);
    const blendedRate = liveRate === null
      ? historicalRate
      : historicalRate * (1 - reliability) + liveRate * reliability;
    return {
      source,
      observations,
      historicalRate,
      posteriorRate: liveRate,
      reliability,
      rawWeight: Math.pow(blendedRate, 2) + 0.05,
    };
  });

  const eligible = sourceStates.filter((state) => state.reliability > 0);
  const averageReliability = eligible.length
    ? eligible.reduce((sum, state) => sum + state.reliability, 0) / eligible.length
    : 0;
  const averageObservationDepth = eligible.length
    ? Math.round(eligible.reduce((sum, state) => sum + state.observations, 0) / eligible.length)
    : 0;
  const strength = Number((PERSISTENT_LIVE_MAX_BLEND * averageReliability).toFixed(6));
  const rawTotal = sourceStates.reduce((sum, state) => sum + state.rawWeight, 0);
  const sourceWeights: PersistentLiveSourceWeight[] = sourceStates.map((state) => ({
    method: state.source.method,
    window: state.source.window,
    observations: state.observations,
    historicalRate: Number(state.historicalRate.toFixed(6)),
    posteriorRate: state.posteriorRate === null ? null : Number(state.posteriorRate.toFixed(6)),
    reliability: Number(state.reliability.toFixed(6)),
    normalizedWeight: Number((rawTotal > 0
      ? state.rawWeight / rawTotal
      : 1 / Math.max(1, sourceStates.length)).toFixed(6)),
  }));

  const metadata: PersistentLiveWeighting = {
    applied: strength > 0 && sourceStates.length > 0,
    changedDigits: false,
    strength,
    eligibleSources: eligible.length,
    averageObservationDepth,
    selectedWindow: result.selectedWindow,
    sourceWeights,
  };

  if (!metadata.applied) return { ...result, liveWeighting: metadata };

  const ensembleVector = Array.from({ length: DIGITS.length }, () => 0);
  sourceStates.forEach((state, index) => {
    const normalizedWeight = sourceWeights[index]?.normalizedWeight ?? 0;
    const vector = probabilityVector(state.source.probabilities);
    for (const digit of DIGITS) ensembleVector[digit] += vector[digit] * normalizedWeight;
  });

  const baseVector = probabilityVector(result.probabilities);
  const combined = normalizeVector(DIGITS.map((digit) =>
    baseVector[digit] * (1 - strength) + ensembleVector[digit] * strength,
  ));
  const rankedDigits = DIGITS.map((digit) => ({ digit, score: combined[digit] }))
    .sort((left, right) => right.score - left.score || left.digit - right.digit);
  const digits = rankedDigits
    .slice(0, result.config.digitCount)
    .map((item) => item.digit)
    .sort((left, right) => left - right);
  const selected = new Set(digits);
  const changedDigits = !sameDigits(digits, result.digits);
  const percent = Number((strength * 100).toFixed(1));

  return {
    ...result,
    digits,
    offDigits: DIGITS.filter((digit) => !selected.has(digit)),
    probabilities: probabilitiesFromVector(combined),
    message: `${result.message} Overlay bobot live persisten aktif ${percent}% dari ${eligible.length} metode dengan kedalaman rata-rata ${averageObservationDepth} observasi.`,
    liveWeighting: {
      ...metadata,
      changedDigits,
    },
  };
}
