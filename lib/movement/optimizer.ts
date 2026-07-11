import type { Posisi } from "../engine/types";
import { DIGITS, digitCombinations, uniqueDigits } from "./helpers";
import type {
  MovementOutputType,
  MovementProbability,
  PositionDistributions,
} from "./types";

export interface MovementSelection {
  digits: number[];
  score: number;
  runnerUpScore: number;
  margin: number;
}

function selectedMass(distribution: number[], selected: Set<number>): number {
  let total = 0;
  for (const digit of selected) total += distribution[digit] ?? 0;
  return Math.max(0, Math.min(1, total));
}

export function objectiveProbability(
  distributions: PositionDistributions,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digits: number[],
): number {
  const selected = new Set(digits);
  const masses = targetPositions.map((position) => selectedMass(distributions[position], selected));

  if (outputType === "position") return masses[0] ?? 0;
  if (outputType === "ai") {
    return 1 - masses.reduce((missProbability, mass) => missProbability * (1 - mass), 1);
  }
  return masses.reduce((allProbability, mass) => allProbability * mass, 1);
}

function lexicographicKey(digits: number[]): string {
  return digits.join("");
}

export function chooseMovementDigits(
  distributions: PositionDistributions,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): MovementSelection {
  const ranked = digitCombinations(digitCount)
    .map((digits) => ({
      digits,
      score: objectiveProbability(distributions, targetPositions, outputType, digits),
    }))
    .sort((left, right) =>
      right.score - left.score || lexicographicKey(left.digits).localeCompare(lexicographicKey(right.digits)),
    );

  const best = ranked[0] ?? { digits: DIGITS.slice(0, digitCount), score: 0 };
  const runnerUp = ranked[1]?.score ?? best.score;
  return {
    digits: uniqueDigits(best.digits),
    score: Number(best.score.toFixed(6)),
    runnerUpScore: Number(runnerUp.toFixed(6)),
    margin: Number(Math.max(0, best.score - runnerUp).toFixed(6)),
  };
}

export function movementProbabilities(
  distributions: PositionDistributions,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
): MovementProbability[] {
  return DIGITS.map((digit) => {
    const values = targetPositions.map((position) => distributions[position][digit] ?? 0);
    let score = values[0] ?? 0;

    if (outputType === "ai") {
      score = 1 - values.reduce((missProbability, value) => missProbability * (1 - value), 1);
    } else if (outputType === "bbfs") {
      score = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    }

    return { digit, score: Number((score * 100).toFixed(2)) };
  }).sort((left, right) => right.score - left.score || left.digit - right.digit);
}
