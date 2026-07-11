import { POS_INDEX, type Draw, type Posisi } from "../engine/types";
import type {
  DigitDistribution,
  MovementConfig,
  MovementEvaluation,
  MovementGroupTarget,
  MovementOutputType,
  MovementTarget,
} from "./types";

export const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const POSITIONS: Posisi[] = ["A", "C", "K", "E"];

const GROUP_POSITIONS: Record<MovementGroupTarget, Posisi[]> = {
  "2d_depan": ["A", "C"],
  "2d_tengah": ["C", "K"],
  "2d_belakang": ["K", "E"],
  "3d_depan": ["A", "C", "K"],
  "3d_belakang": ["C", "K", "E"],
  "4d": ["A", "C", "K", "E"],
};

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function digitAt(draw: Draw, position: Posisi): number {
  return Number(draw[POS_INDEX[position]]);
}

export function modularDelta(previous: number, current: number): number {
  return (current - previous + 10) % 10;
}

export function signedDelta(previous: number, current: number): number {
  const delta = modularDelta(previous, current);
  return delta > 5 ? delta - 10 : delta;
}

export function uniqueDigits(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function targetPositionsFor(outputType: MovementOutputType, target: MovementTarget): Posisi[] {
  if (outputType === "position") {
    if (target === "A" || target === "C" || target === "K" || target === "E") return [target];
    throw new Error("Target posisi tidak valid untuk output Posisi.");
  }

  if (target === "A" || target === "C" || target === "K" || target === "E") {
    throw new Error("Target gabungan wajib dipilih untuk output AI atau BBFS.");
  }
  return [...GROUP_POSITIONS[target]];
}

export function targetDigitsOf(draw: Draw, positions: Posisi[]): number[] {
  return positions.map((position) => digitAt(draw, position));
}

export function minimumDigitCount(config: Pick<MovementConfig, "outputType" | "target">): number {
  if (config.outputType !== "bbfs") return 1;
  return targetPositionsFor(config.outputType, config.target).length;
}

export function normalizeDigitCount(config: MovementConfig): number {
  return clamp(Math.trunc(config.digitCount || 1), minimumDigitCount(config), 9);
}

export function isCovered(
  outputDigits: number[],
  targetDigits: number[],
  outputType: MovementOutputType,
): boolean {
  const selected = new Set(outputDigits);
  if (outputType === "ai") return targetDigits.some((digit) => selected.has(digit));
  if (outputType === "bbfs") return uniqueDigits(targetDigits).every((digit) => selected.has(digit));
  return targetDigits.length > 0 && selected.has(targetDigits[0]);
}

export function theoreticalBaseline(
  outputType: MovementOutputType,
  digitCount: number,
  targetPositionCount: number,
): number {
  const selectedProbability = digitCount / 10;
  if (outputType === "ai") {
    return Number(((1 - Math.pow(1 - selectedProbability, targetPositionCount)) * 100).toFixed(1));
  }
  if (outputType === "bbfs") {
    return Number((Math.pow(selectedProbability, targetPositionCount) * 100).toFixed(1));
  }
  return Number((selectedProbability * 100).toFixed(1));
}

export function longestMissStreak(statuses: boolean[]): number {
  let longest = 0;
  let current = 0;
  for (const status of statuses) {
    if (status) current = 0;
    else {
      current += 1;
      longest = Math.max(longest, current);
    }
  }
  return longest;
}

export function evaluationOf(
  statuses: boolean[],
  outputType: MovementOutputType,
  digitCount: number,
  targetPositionCount: number,
): MovementEvaluation {
  const total = statuses.length;
  const hit = statuses.filter(Boolean).length;
  const rate = total ? Number(((hit / total) * 100).toFixed(1)) : 0;
  const baseline = theoreticalBaseline(outputType, digitCount, targetPositionCount);
  return {
    hit,
    total,
    rate,
    baseline,
    lift: Number((rate - baseline).toFixed(1)),
    longestMissStreak: longestMissStreak(statuses),
  };
}

export function normalizeDistribution(values: number[]): DigitDistribution {
  const safe = values.map((value) => Math.max(0, Number.isFinite(value) ? value : 0));
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (!safe.length) return [];
  if (!total) return safe.map(() => 1 / safe.length);
  return safe.map((value) => value / total);
}

export function digitCombinations(size: number): number[][] {
  const safeSize = clamp(Math.trunc(size), 1, 9);
  const combinations: number[][] = [];

  function walk(start: number, current: number[]) {
    if (current.length === safeSize) {
      combinations.push([...current]);
      return;
    }
    for (let index = start; index < DIGITS.length; index += 1) {
      current.push(DIGITS[index]);
      walk(index + 1, current);
      current.pop();
    }
  }

  walk(0, []);
  return combinations;
}

export function objectiveLabel(outputType: MovementOutputType, positions: Posisi[]): string {
  if (outputType === "position") return `Digit posisi ${positions[0]} berikutnya masuk ke output`;
  if (outputType === "ai") return "Minimal satu digit target berikutnya masuk ke output AI";
  return "Semua digit target berikutnya masuk ke output BBFS";
}
