import type { Draw } from "../engine/types";
import {
  clamp,
  targetDigitsOf,
  targetPositionsFor,
  uniqueDigits,
} from "./helpers";
import type {
  MovementOutputType,
  MovementTarget,
} from "./types";

export const ADAPTIVE_CHANCE_MODEL_VERSION = "conditional-combinatorial-v1";

export interface AdaptiveChanceBenchmark {
  probability: number;
  uniqueTargetCount: number;
  digitCount: number;
  modelVersion: typeof ADAPTIVE_CHANCE_MODEL_VERSION;
}

export interface ChanceBenchmarkObservation {
  isHit: boolean;
  chanceProbability: number | null | undefined;
}

export interface ChanceBenchmarkSummary {
  sampleSize: number;
  observedHits: number;
  observedHitRate: number;
  expectedHits: number;
  expectedHitRate: number;
  edgeHits: number;
  edgePoints: number;
}

function combination(total: number, selected: number): number {
  const n = Math.trunc(total);
  const k = Math.trunc(selected);
  if (n < 0 || k < 0 || k > n) return 0;
  const reduced = Math.min(k, n - k);
  let result = 1;
  for (let index = 1; index <= reduced; index += 1) {
    result = (result * (n - reduced + index)) / index;
  }
  return result;
}

function fixed(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

export function adaptiveChanceBenchmark(
  outputType: MovementOutputType,
  target: MovementTarget,
  digitCount: number,
  actualResult: Draw,
): AdaptiveChanceBenchmark {
  if (!/^\d{4}$/.test(actualResult)) {
    throw new Error("Result aktual benchmark harus tepat 4 digit.");
  }

  const normalizedDigitCount = clamp(Math.trunc(digitCount), 1, 9);
  const targetDigits = targetDigitsOf(
    actualResult,
    targetPositionsFor(outputType, target),
  );
  const uniqueTargetCount = uniqueDigits(targetDigits).length;
  const totalSelections = combination(10, normalizedDigitCount);

  let probability = 0;
  if (outputType === "position") {
    probability = normalizedDigitCount / 10;
  } else if (outputType === "ai") {
    const noTargetSelections = combination(
      10 - uniqueTargetCount,
      normalizedDigitCount,
    );
    probability = 1 - noTargetSelections / totalSelections;
  } else if (normalizedDigitCount >= uniqueTargetCount) {
    const allTargetSelections = combination(
      10 - uniqueTargetCount,
      normalizedDigitCount - uniqueTargetCount,
    );
    probability = allTargetSelections / totalSelections;
  }

  return {
    probability: fixed(clamp(probability, 0, 1), 12),
    uniqueTargetCount,
    digitCount: normalizedDigitCount,
    modelVersion: ADAPTIVE_CHANCE_MODEL_VERSION,
  };
}

export function summarizeChanceBenchmark(
  observations: ChanceBenchmarkObservation[],
): ChanceBenchmarkSummary {
  const benchmarked = observations.flatMap((observation) => {
    const probability = Number(observation.chanceProbability);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) return [];
    return [{ isHit: observation.isHit, probability }];
  });

  const sampleSize = benchmarked.length;
  const observedHits = benchmarked.filter((row) => row.isHit).length;
  const expectedHits = benchmarked.reduce((sum, row) => sum + row.probability, 0);
  const observedHitRate = sampleSize ? (observedHits / sampleSize) * 100 : 0;
  const expectedHitRate = sampleSize ? (expectedHits / sampleSize) * 100 : 0;

  return {
    sampleSize,
    observedHits,
    observedHitRate: fixed(observedHitRate, 2),
    expectedHits: fixed(expectedHits, 4),
    expectedHitRate: fixed(expectedHitRate, 2),
    edgeHits: fixed(observedHits - expectedHits, 4),
    edgePoints: fixed(observedHitRate - expectedHitRate, 2),
  };
}
