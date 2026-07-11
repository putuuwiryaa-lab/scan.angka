import {
  digitOf,
  is3DMode,
  isJumlah2DMode,
  isShioMode,
  jumlah2dDigit,
  target2DPositions,
  target3DPositions,
  targetDigitsOf,
  targetShioIndexOf,
  uniqueDigits,
} from "../engine/helpers";
import type { Draw, Kolom, Posisi, ScanMode, Target2D, Target3D } from "../engine/types";
import { echoColumnsForMode, echoDeretForMode } from "./audit";
import { ECHO_MIN_HISTORY, type EchoEvaluationPlan } from "./config";
import type { EchoPrediction } from "./pattern";
import type {
  EchoBacktestRow,
  EchoConfidenceLevel,
  EchoNeighbor,
  EchoProfile,
  EchoRegime,
} from "./types";

function modulusForMode(scanMode: ScanMode): number {
  return isShioMode(scanMode) ? 12 : 10;
}

function sourceValue(draws: Draw[], index: number, profile: EchoProfile, target2D: Target2D): number {
  if (profile.sourceKind === "jumlah2d") {
    const [left, right] = target2DPositions(target2D);
    return jumlah2dDigit(digitOf(draws[index], left), digitOf(draws[index], right));
  }
  if (profile.sourceKind === "shio") return targetShioIndexOf(draws[index], target2D);
  return digitOf(draws[index], profile.anchorPos ?? "K");
}

function circularDelta(current: number, previous: number, modulus: number): number {
  const raw = ((current - previous) % modulus + modulus) % modulus;
  return raw > modulus / 2 ? raw - modulus : raw;
}

function normalize(values: number[]): number[] {
  const maximum = Math.max(...values, 0);
  if (maximum <= 0) return values.map(() => 0);
  return values.map((value) => value / maximum);
}

function scoreVector(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  target2D: Target2D,
  modulus: number,
  halfLife: number,
): { scores: number[]; weights: number[]; effectiveSample: number } {
  const counts = Array.from({ length: modulus }, () => 0);
  const lastSeen = Array.from({ length: modulus }, () => -1);
  const weights: number[] = [];

  for (let index = 0; index < targetIndex; index += 1) {
    const age = targetIndex - 1 - index;
    const weight = Math.pow(0.5, age / halfLife);
    const value = sourceValue(draws, index, profile, target2D);
    counts[value] += weight;
    lastSeen[value] = index;
    weights.push(weight);
  }

  const hot = normalize(counts);
  const due = normalize(lastSeen.map((index) => Math.min(36, index < 0 ? 36 : targetIndex - 1 - index)));
  const cold = hot.map((value) => 1 - value);
  let scores: number[];

  if (profile.variant === "frequencyDue") {
    scores = due.map((value, digit) => 0.72 * value + 0.28 * cold[digit]);
  } else if (profile.variant === "frequencyBalanced") {
    scores = hot.map((value, digit) => 0.58 * value + 0.42 * due[digit]);
  } else {
    scores = hot;
  }

  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const weightSquares = weights.reduce((sum, value) => sum + value * value, 0);
  return {
    scores,
    weights,
    effectiveSample: weightSquares > 0 ? (weightSum * weightSum) / weightSquares : 0,
  };
}

function ranking(scores: number[]): Array<{ digit: number; score: number }> {
  return scores
    .map((score, digit) => ({ digit, score }))
    .sort((left, right) => right.score - left.score || left.digit - right.digit);
}

function confidenceLevel(confidence: number): EchoConfidenceLevel {
  if (confidence >= 75) return "HIGH";
  if (confidence >= 55) return "MEDIUM";
  return "LOW";
}

function regimeOf(draws: Draw[], targetIndex: number, profile: EchoProfile, target2D: Target2D, modulus: number): EchoRegime {
  if (targetIndex < 4) return "MIXED";
  const movements = [targetIndex - 3, targetIndex - 2, targetIndex - 1].map((index) =>
    circularDelta(
      sourceValue(draws, index, profile, target2D),
      sourceValue(draws, index - 1, profile, target2D),
      modulus,
    ));
  if (movements.every((movement) => movement === 0)) return "REPEAT";
  if (movements.every((movement) => movement >= 0) && movements.some((movement) => movement > 0)) return "TREND_UP";
  if (movements.every((movement) => movement <= 0) && movements.some((movement) => movement < 0)) return "TREND_DOWN";
  if (movements.slice(1).every((movement, index) => Math.sign(movement) !== Math.sign(movements[index]))) return "ZIGZAG";
  return "MIXED";
}

function buildNeighbors(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  target2D: Target2D,
  modulus: number,
  halfLife: number,
  patokan: number,
): EchoNeighbor[] {
  const neighbors: EchoNeighbor[] = [];
  for (let index = Math.max(1, targetIndex - 40); index < targetIndex; index += 1) {
    const value = sourceValue(draws, index, profile, target2D);
    const previous = sourceValue(draws, index - 1, profile, target2D);
    const age = targetIndex - 1 - index;
    const recency = Math.pow(0.5, age / halfLife);
    const match = value === patokan ? 1 : 0.25;
    neighbors.push({
      anchorIndex: index,
      anchorDraw: draws[index - 1],
      nextDraw: draws[index],
      distance: value === patokan ? 0 : 1,
      weight: recency * match,
      movement: circularDelta(value, previous, modulus),
      projectedDigit: value,
      regime: value === previous ? "REPEAT" : "MIXED",
    });
  }
  return neighbors
    .sort((left, right) => right.weight - left.weight || right.anchorIndex - left.anchorIndex)
    .slice(0, 14);
}

export function predictFrequencyAt(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  scanMode: ScanMode,
  target2D: Target2D,
  plan: EchoEvaluationPlan,
): EchoPrediction | null {
  if (targetIndex < ECHO_MIN_HISTORY || targetIndex > draws.length) return null;
  const modulus = modulusForMode(scanMode);
  const predictions: number[] = [];
  const vectors = plan.halfLives.map((halfLife) => {
    const vector = scoreVector(draws, targetIndex, profile, target2D, modulus, halfLife);
    predictions.push(ranking(vector.scores)[0]?.digit ?? 0);
    return { halfLife, ...vector };
  });
  const counts = new Map<number, number>();
  for (const prediction of predictions) counts.set(prediction, (counts.get(prediction) ?? 0) + 1);
  const maximumCount = Math.max(...counts.values());
  const tied = [...counts.entries()].filter(([, count]) => count === maximumCount).map(([digit]) => digit);
  const middle = vectors[Math.floor(vectors.length / 2)] ?? vectors[0];
  if (!middle) return null;
  const middleRanking = ranking(middle.scores);
  const base = middleRanking[0]?.digit ?? 0;
  const patokan = tied.includes(base) ? base : tied.sort((left, right) => left - right)[0] ?? base;
  const stability = predictions.length ? predictions.filter((value) => value === patokan).length / predictions.length : 0;
  const top = middleRanking[0]?.score ?? 0;
  const second = middleRanking[1]?.score ?? 0;
  const margin = top > 0 ? Math.max(0, (top - second) / top) : 0;
  const scoreTotal = middle.scores.reduce((sum, value) => sum + value, 0);
  const dominantShare = scoreTotal > 0 ? top / scoreTotal : 0;
  const confidence = Math.round((
    0.38 * stability +
    0.27 * Math.min(1, margin / 0.25) +
    0.2 * Math.min(1, middle.effectiveSample / 12) +
    0.15 * Math.min(1, dominantShare * modulus * 1.25)
  ) * 100);
  const neighbors = buildNeighbors(
    draws,
    targetIndex,
    profile,
    target2D,
    modulus,
    middle.halfLife,
    patokan,
  );

  return {
    patokan,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    quality: {
      neighborCount: neighbors.length,
      effectiveNeighbors: Number(Math.min(14, middle.effectiveSample).toFixed(2)),
      meanDistance: Number((1 - top).toFixed(3)),
      dominantShare: Number((dominantShare * 100).toFixed(1)),
      stability: Number((stability * 100).toFixed(1)),
      ensembleStability: Number((stability * 100).toFixed(1)),
      regimeAgreement: Number((stability * 100).toFixed(1)),
      regime: regimeOf(draws, targetIndex, profile, target2D, modulus),
    },
    neighbors,
  };
}

function areaForMode(scanMode: ScanMode, target2D: Target2D, target3D: Target3D): Posisi[] {
  if (is3DMode(scanMode)) return [...target3DPositions(target3D)];
  if (scanMode === "posisi" || scanMode === "off_posisi") return [];
  return [...target2DPositions(target2D)];
}

export function buildFrequencyProfiles(
  scanMode: ScanMode,
  targetPos: Posisi,
  target2D: Target2D,
  target3D: Target3D,
): EchoProfile[] {
  const profiles: EchoProfile[] = [];
  const area = areaForMode(scanMode, target2D, target3D);
  const add = (
    variant: "frequencyHot" | "frequencyDue" | "frequencyBalanced",
    formula: string,
    anchorPos: Posisi | null,
    sourceKind: EchoProfile["sourceKind"],
  ) => profiles.push({ family: "EF", variant, formula, anchorPos, sourceKind, areaPositions: area });

  if (isShioMode(scanMode)) {
    add("frequencyHot", `EFH-S-${target2D[0].toUpperCase()}`, null, "shio");
    add("frequencyDue", `EFD-S-${target2D[0].toUpperCase()}`, null, "shio");
    add("frequencyBalanced", `EFB-S-${target2D[0].toUpperCase()}`, null, "shio");
    return profiles;
  }

  if (isJumlah2DMode(scanMode)) {
    add("frequencyHot", `EFH-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("frequencyDue", `EFD-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("frequencyBalanced", `EFB-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    return profiles;
  }

  const anchors = scanMode === "posisi" || scanMode === "off_posisi" ? [targetPos] : area;
  for (const anchor of anchors) {
    add("frequencyHot", `EFH-${anchor}`, anchor, "position");
    add("frequencyDue", `EFD-${anchor}`, anchor, "position");
    add("frequencyBalanced", `EFB-${anchor}`, anchor, "position");
  }
  return profiles;
}

function targetColumnsForRow(deret: number[], targetDigits: number[], scanMode: ScanMode): Kolom[] {
  const columns = echoColumnsForMode(scanMode);
  return uniqueDigits(targetDigits)
    .map((digit) => columns[deret.indexOf(digit)])
    .filter((column): column is Kolom => Boolean(column));
}

export function buildFrequencyBacktestRows(
  draws: Draw[],
  profile: EchoProfile,
  scanMode: ScanMode,
  targetPos: Posisi,
  target2D: Target2D,
  target3D: Target3D,
  plan: EchoEvaluationPlan,
): EchoBacktestRow[] {
  const start = Math.max(ECHO_MIN_HISTORY, draws.length - plan.totalRows);
  const rows: EchoBacktestRow[] = [];
  for (let targetIndex = start; targetIndex < draws.length; targetIndex += 1) {
    const prediction = predictFrequencyAt(draws, targetIndex, profile, scanMode, target2D, plan);
    if (!prediction) continue;
    const deret = echoDeretForMode(prediction.patokan, scanMode);
    const targetDigits = targetDigitsOf(draws[targetIndex], scanMode, targetPos, target2D, target3D);
    rows.push({
      targetIndex,
      displayDraw: draws[targetIndex - 1],
      targetDraw: draws[targetIndex],
      patokan: prediction.patokan,
      deret,
      targetDigits,
      targetColumns: targetColumnsForRow(deret, targetDigits, scanMode),
      covered: false,
      phase: "discovery",
      confidence: prediction.confidence,
      effectiveNeighbors: prediction.quality.effectiveNeighbors,
    });
  }
  return rows.slice(-plan.totalRows);
}
