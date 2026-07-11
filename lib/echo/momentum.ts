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

function circularAdd(value: number, movement: number, modulus: number): number {
  return ((value + movement) % modulus + modulus) % modulus;
}

function movementWindow(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  target2D: Target2D,
  modulus: number,
  size: number,
): number[] {
  const start = Math.max(1, targetIndex - size);
  const result: number[] = [];
  for (let index = start; index < targetIndex; index += 1) {
    result.push(circularDelta(
      sourceValue(draws, index, profile, target2D),
      sourceValue(draws, index - 1, profile, target2D),
      modulus,
    ));
  }
  return result;
}

function weightedMean(values: number[]): number {
  if (!values.length) return 0;
  let sum = 0;
  let weightSum = 0;
  values.forEach((value, index) => {
    const weight = index + 1;
    sum += value * weight;
    weightSum += weight;
  });
  return weightSum ? sum / weightSum : 0;
}

function alternating(values: number[]): boolean {
  const nonZero = values.filter((value) => value !== 0);
  return nonZero.length >= 3 && nonZero.slice(1).every((value, index) => Math.sign(value) !== Math.sign(nonZero[index]));
}

function projectMovement(values: number[], variant: EchoProfile["variant"]): number {
  if (!values.length) return 0;
  const last = values[values.length - 1] ?? 0;
  const average = weightedMean(values);

  if (variant === "momentumReversal") {
    const source = Math.abs(last) >= 1 ? last : Math.round(average);
    return -source;
  }

  if (variant === "momentumZigzag") {
    if (alternating(values)) return -last;
    if (Math.sign(last) === Math.sign(average)) return -last;
    return Math.round(average);
  }

  const projected = Math.round(0.65 * average + 0.35 * last);
  if (projected !== 0) return projected;
  return last;
}

function regimeOf(values: number[]): EchoRegime {
  if (!values.length) return "MIXED";
  if (values.every((value) => value === 0)) return "REPEAT";
  if (alternating(values)) return "ZIGZAG";
  if (values.every((value) => value >= 0) && values.some((value) => value > 0)) return "TREND_UP";
  if (values.every((value) => value <= 0) && values.some((value) => value < 0)) return "TREND_DOWN";
  const magnitudes = values.map(Math.abs);
  if (magnitudes.length >= 3 && magnitudes.slice(1).every((value, index) => value >= magnitudes[index])) return "EXPANDING";
  if (magnitudes.length >= 3 && magnitudes.slice(1).every((value, index) => value <= magnitudes[index])) return "COMPRESSING";
  return "MIXED";
}

function confidenceLevel(confidence: number): EchoConfidenceLevel {
  if (confidence >= 75) return "HIGH";
  if (confidence >= 55) return "MEDIUM";
  return "LOW";
}

function buildNeighbors(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  target2D: Target2D,
  modulus: number,
  expectedMovement: number,
): EchoNeighbor[] {
  const neighbors: EchoNeighbor[] = [];
  for (let index = Math.max(1, targetIndex - 30); index < targetIndex; index += 1) {
    const current = sourceValue(draws, index, profile, target2D);
    const previous = sourceValue(draws, index - 1, profile, target2D);
    const movement = circularDelta(current, previous, modulus);
    const distance = Math.min(1, Math.abs(movement - expectedMovement) / Math.max(1, modulus / 2));
    const age = targetIndex - 1 - index;
    const weight = Math.exp(-distance / 0.35) * Math.pow(0.5, age / 12);
    neighbors.push({
      anchorIndex: index,
      anchorDraw: draws[index - 1],
      nextDraw: draws[index],
      distance,
      weight,
      movement,
      projectedDigit: current,
      regime: movement > 0 ? "TREND_UP" : movement < 0 ? "TREND_DOWN" : "FLAT",
    });
  }
  return neighbors
    .sort((left, right) => right.weight - left.weight || right.anchorIndex - left.anchorIndex)
    .slice(0, 14);
}

export function predictMomentumAt(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  scanMode: ScanMode,
  target2D: Target2D,
  _plan: EchoEvaluationPlan,
): EchoPrediction | null {
  if (targetIndex < ECHO_MIN_HISTORY || targetIndex > draws.length) return null;
  const modulus = modulusForMode(scanMode);
  const current = sourceValue(draws, targetIndex - 1, profile, target2D);
  const windows = [3, 4, 5, 7].filter((size) => targetIndex > size);
  if (!windows.length) return null;
  const projections = windows.map((size) => {
    const movements = movementWindow(draws, targetIndex, profile, target2D, modulus, size);
    const movement = projectMovement(movements, profile.variant);
    return {
      size,
      movements,
      movement,
      digit: circularAdd(current, movement, modulus),
    };
  });
  const counts = new Map<number, number>();
  for (const projection of projections) counts.set(projection.digit, (counts.get(projection.digit) ?? 0) + 1);
  const maximumCount = Math.max(...counts.values());
  const tied = [...counts.entries()].filter(([, count]) => count === maximumCount).map(([digit]) => digit);
  const base = projections[Math.floor(projections.length / 2)]?.digit ?? current;
  const patokan = tied.includes(base) ? base : tied.sort((left, right) => left - right)[0] ?? base;
  const stability = projections.filter((projection) => projection.digit === patokan).length / projections.length;
  const representative = projections
    .filter((projection) => projection.digit === patokan)
    .sort((left, right) => right.size - left.size)[0] ?? projections[0];
  if (!representative) return null;
  const movements = representative.movements;
  const nonZero = movements.filter((value) => value !== 0);
  const directionAgreement = nonZero.length
    ? Math.max(
      nonZero.filter((value) => value > 0).length,
      nonZero.filter((value) => value < 0).length,
    ) / nonZero.length
    : 1;
  const magnitudeStability = movements.length > 1
    ? Math.max(0, 1 - (Math.max(...movements.map(Math.abs)) - Math.min(...movements.map(Math.abs))) / Math.max(1, modulus / 2))
    : 1;
  const confidence = Math.round((
    0.48 * stability +
    0.24 * directionAgreement +
    0.18 * magnitudeStability +
    0.1 * Math.min(1, movements.length / 7)
  ) * 100);
  const neighbors = buildNeighbors(draws, targetIndex, profile, target2D, modulus, representative.movement);
  const weightSum = neighbors.reduce((sum, item) => sum + item.weight, 0);
  const weightSquares = neighbors.reduce((sum, item) => sum + item.weight * item.weight, 0);
  const effectiveNeighbors = weightSquares > 0 ? (weightSum * weightSum) / weightSquares : 0;
  const meanDistance = weightSum > 0
    ? neighbors.reduce((sum, item) => sum + item.distance * item.weight, 0) / weightSum
    : 1;

  return {
    patokan,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    quality: {
      neighborCount: neighbors.length,
      effectiveNeighbors: Number(Math.max(5, effectiveNeighbors).toFixed(2)),
      meanDistance: Number(meanDistance.toFixed(3)),
      dominantShare: Number((stability * 100).toFixed(1)),
      stability: Number((stability * 100).toFixed(1)),
      ensembleStability: Number((stability * 100).toFixed(1)),
      regimeAgreement: Number((directionAgreement * 100).toFixed(1)),
      regime: regimeOf(movements),
    },
    neighbors,
  };
}

function areaForMode(scanMode: ScanMode, target2D: Target2D, target3D: Target3D): Posisi[] {
  if (is3DMode(scanMode)) return [...target3DPositions(target3D)];
  if (scanMode === "posisi" || scanMode === "off_posisi") return [];
  return [...target2DPositions(target2D)];
}

export function buildMomentumProfiles(
  scanMode: ScanMode,
  targetPos: Posisi,
  target2D: Target2D,
  target3D: Target3D,
): EchoProfile[] {
  const profiles: EchoProfile[] = [];
  const area = areaForMode(scanMode, target2D, target3D);
  const add = (
    variant: "momentumTrend" | "momentumReversal" | "momentumZigzag",
    formula: string,
    anchorPos: Posisi | null,
    sourceKind: EchoProfile["sourceKind"],
  ) => profiles.push({ family: "EM", variant, formula, anchorPos, sourceKind, areaPositions: area });

  if (isShioMode(scanMode)) {
    add("momentumTrend", `EMT-S-${target2D[0].toUpperCase()}`, null, "shio");
    add("momentumReversal", `EMR-S-${target2D[0].toUpperCase()}`, null, "shio");
    add("momentumZigzag", `EMZ-S-${target2D[0].toUpperCase()}`, null, "shio");
    return profiles;
  }

  if (isJumlah2DMode(scanMode)) {
    add("momentumTrend", `EMT-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("momentumReversal", `EMR-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("momentumZigzag", `EMZ-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    return profiles;
  }

  const anchors = scanMode === "posisi" || scanMode === "off_posisi" ? [targetPos] : area;
  for (const anchor of anchors) {
    add("momentumTrend", `EMT-${anchor}`, anchor, "position");
    add("momentumReversal", `EMR-${anchor}`, anchor, "position");
    add("momentumZigzag", `EMZ-${anchor}`, anchor, "position");
  }
  return profiles;
}

function targetColumnsForRow(deret: number[], targetDigits: number[], scanMode: ScanMode): Kolom[] {
  const columns = echoColumnsForMode(scanMode);
  return uniqueDigits(targetDigits)
    .map((digit) => columns[deret.indexOf(digit)])
    .filter((column): column is Kolom => Boolean(column));
}

export function buildMomentumBacktestRows(
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
    const prediction = predictMomentumAt(draws, targetIndex, profile, scanMode, target2D, plan);
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
