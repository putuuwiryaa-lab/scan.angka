import {
  buildDeret,
  buildDeretShio,
  clamp,
  digitOf,
  is3DMode,
  isJumlah2DMode,
  isOffMode,
  isShioMode,
  jumlah2dDigit,
  scanModeOrDefault,
  target2DOrDefault,
  target2DPositions,
  target3DOrDefault,
  target3DPositions,
  targetDigitsOf,
  targetShioIndexOf,
  uniqueDigits,
} from "../engine/helpers";
import { KOLOM, SHIO_KOLOM, type Draw, type Kolom, type Posisi, type ScanMode, type Target2D, type Target3D } from "../engine/types";
import type {
  EchoAudit,
  EchoBacktestRow,
  EchoConfidenceLevel,
  EchoConfig,
  EchoFamily,
  EchoItem,
  EchoNeighbor,
  EchoProfile,
  EchoQuality,
  EchoRegime,
  EchoResult,
  EchoStrength,
  EchoVariant,
  EchoWindowAudit,
} from "./types";

const POSITIONS: Posisi[] = ["A", "C", "K", "E"];
const STATE_WINDOW = 5;
const MIN_HISTORY = 40;
const MIN_TOTAL_DATA = 80;
const MIN_NEIGHBORS = 7;
const ABSOLUTE_MAX_NEIGHBORS = 14;
const RECENT_SIZE = 5;

interface WindowSpec {
  size: number;
  weight: number;
}

interface EvaluationPlan {
  discoveryWindows: WindowSpec[];
  discoverySize: number;
  validationSize: number;
  holdoutSize: number;
  totalRows: number;
  maximumNeighbors: number;
  halfLives: number[];
}

interface EchoState {
  vector: number[];
  weights: number[];
  regime: EchoRegime;
}

interface RawNeighbor {
  anchorIndex: number;
  anchorDraw: Draw;
  nextDraw: Draw;
  distance: number;
  movement: number;
  regime: EchoRegime;
}

interface Prediction {
  patokan: number;
  confidence: number;
  confidenceLevel: EchoConfidenceLevel;
  quality: EchoQuality;
  neighbors: EchoNeighbor[];
}

interface ColumnSelection {
  columns: Kolom[];
  audit: EchoAudit;
  rows: EchoBacktestRow[];
  efficiency: number;
}

function evaluationPlan(totalData: number): EvaluationPlan {
  if (totalData >= 220) {
    const discoveryWindows = [{ size: 16, weight: 0.4 }, { size: 32, weight: 0.35 }, { size: 48, weight: 0.25 }];
    return { discoveryWindows, discoverySize: 48, validationSize: 16, holdoutSize: 16, totalRows: 80, maximumNeighbors: 14, halfLives: [55, 85, 125] };
  }
  if (totalData >= 150) {
    const discoveryWindows = [{ size: 12, weight: 0.4 }, { size: 24, weight: 0.35 }, { size: 36, weight: 0.25 }];
    return { discoveryWindows, discoverySize: 36, validationSize: 12, holdoutSize: 12, totalRows: 60, maximumNeighbors: 14, halfLives: [45, 70, 105] };
  }
  if (totalData >= 120) {
    const discoveryWindows = [{ size: 10, weight: 0.4 }, { size: 20, weight: 0.35 }, { size: 30, weight: 0.25 }];
    return { discoveryWindows, discoverySize: 30, validationSize: 10, holdoutSize: 10, totalRows: 50, maximumNeighbors: 12, halfLives: [40, 65, 95] };
  }
  if (totalData >= 95) {
    const discoveryWindows = [{ size: 8, weight: 0.4 }, { size: 16, weight: 0.35 }, { size: 24, weight: 0.25 }];
    return { discoveryWindows, discoverySize: 24, validationSize: 8, holdoutSize: 8, totalRows: 40, maximumNeighbors: 11, halfLives: [35, 55, 80] };
  }
  const discoveryWindows = [{ size: 6, weight: 0.4 }, { size: 12, weight: 0.35 }, { size: 18, weight: 0.25 }];
  return { discoveryWindows, discoverySize: 18, validationSize: 6, holdoutSize: 6, totalRows: 30, maximumNeighbors: 10, halfLives: [30, 48, 70] };
}

function modulusForMode(mode: ScanMode): number {
  return isShioMode(mode) ? 12 : 10;
}

function circularDelta(current: number, previous: number, modulus: number): number {
  const raw = ((current - previous) % modulus + modulus) % modulus;
  return raw > modulus / 2 ? raw - modulus : raw;
}

function circularDistance(left: number, right: number, modulus: number): number {
  return Math.abs(circularDelta(left, right, modulus));
}

function circularAdd(value: number, movement: number, modulus: number): number {
  return ((value + movement) % modulus + modulus) % modulus;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function spreadOf(draw: Draw): number {
  const values = POSITIONS.map((pos) => digitOf(draw, pos));
  return Math.max(...values) - Math.min(...values);
}

function repeatCount(draw: Draw): number {
  const values = POSITIONS.map((pos) => digitOf(draw, pos));
  return values.length - new Set(values).size;
}

function parityRatio(draw: Draw): number {
  return POSITIONS.filter((pos) => digitOf(draw, pos) % 2 === 0).length / POSITIONS.length;
}

function signChangeRate(values: number[]): number {
  let comparisons = 0;
  let changes = 0;
  for (let index = 0; index + 1 < values.length; index += 1) {
    if (values[index] === 0 || values[index + 1] === 0) continue;
    comparisons += 1;
    if (Math.sign(values[index]) !== Math.sign(values[index + 1])) changes += 1;
  }
  return comparisons ? changes / comparisons : 0;
}

function recurrenceGap(index: number, value: number, getter: (drawIndex: number) => number): number {
  for (let cursor = index - 1; cursor >= Math.max(0, index - 16); cursor -= 1) {
    if (getter(cursor) === value) return index - cursor;
  }
  return 16;
}

function areaForMode(mode: ScanMode, target2D: Target2D, target3D: Target3D): Posisi[] {
  if (is3DMode(mode)) return [...target3DPositions(target3D)];
  if (mode === "posisi" || mode === "off_posisi") return [];
  return [...target2DPositions(target2D)];
}

function sourceValue(draws: Draw[], index: number, profile: EchoProfile, target2D: Target2D): number {
  if (profile.sourceKind === "jumlah2d") {
    const [left, right] = target2DPositions(target2D);
    return jumlah2dDigit(digitOf(draws[index], left), digitOf(draws[index], right));
  }
  if (profile.sourceKind === "shio") return targetShioIndexOf(draws[index], target2D);
  return digitOf(draws[index], profile.anchorPos ?? "K");
}

function classifyRegime(draws: Draw[], anchor: number): EchoRegime {
  const latest = draws[anchor];
  const previous = draws[anchor - 1];
  const before = draws[anchor - 2];
  const currentMoves = POSITIONS.map((pos) => circularDelta(digitOf(latest, pos), digitOf(previous, pos), 10));
  const priorMoves = POSITIONS.map((pos) => circularDelta(digitOf(previous, pos), digitOf(before, pos), 10));
  const positives = currentMoves.filter((value) => value > 0).length;
  const negatives = currentMoves.filter((value) => value < 0).length;
  const flat = currentMoves.filter((value) => Math.abs(value) <= 1).length;
  const reversals = currentMoves.filter((value, index) => value !== 0 && priorMoves[index] !== 0 && Math.sign(value) !== Math.sign(priorMoves[index])).length;
  const spreadChange = spreadOf(latest) - spreadOf(previous);

  if (repeatCount(latest) >= 2) return "REPEAT";
  if (flat >= 3) return "FLAT";
  if (reversals >= 3) return "ZIGZAG";
  if (spreadChange >= 3) return "EXPANDING";
  if (spreadChange <= -3) return "COMPRESSING";
  if (positives >= 3) return "TREND_UP";
  if (negatives >= 3) return "TREND_DOWN";
  return "MIXED";
}

function normalizedDelta(value: number, modulus: number): number {
  return value / (modulus / 2);
}

function buildState(draws: Draw[], anchor: number, profile: EchoProfile, target2D: Target2D): EchoState {
  const modulus = profile.sourceKind === "shio" ? 12 : 10;
  const valueAt = (index: number) => sourceValue(draws, index, profile, target2D);
  const values = [0, 1, 2, 3, 4].map((lag) => valueAt(anchor - lag));
  const movements = [0, 1, 2, 3].map((lag) => circularDelta(values[lag], values[lag + 1], modulus));
  const normalizedMoves = movements.map((value) => normalizedDelta(value, modulus));
  const acceleration = normalizedDelta(movements[0] - movements[1], modulus);
  const net3 = normalizedDelta(circularDelta(values[0], values[3], modulus), modulus);
  const net4 = normalizedDelta(circularDelta(values[0], values[4], modulus), modulus);
  const volatility = mean(movements.map((value) => Math.abs(normalizedDelta(value, modulus))));
  const reversals = signChangeRate(movements);
  const recurrence = recurrenceGap(anchor, values[0], valueAt) / 16;
  const regime = classifyRegime(draws, anchor);

  if (profile.variant === "local") {
    return {
      vector: [...normalizedMoves, acceleration, net3, net4, volatility, reversals, recurrence],
      weights: [1.45, 1.15, 0.85, 0.65, 1.05, 0.85, 0.55, 0.55, 0.45, 0.35],
      regime,
    };
  }

  const currentDraw = draws[anchor];
  const previousDraw = draws[anchor - 1];
  const beforeDraw = draws[anchor - 2];
  const thirdDraw = draws[anchor - 3];
  const movementNow = POSITIONS.map((pos) => normalizedDelta(circularDelta(digitOf(currentDraw, pos), digitOf(previousDraw, pos), 10), 10));
  const movementBefore = POSITIONS.map((pos) => normalizedDelta(circularDelta(digitOf(previousDraw, pos), digitOf(beforeDraw, pos), 10), 10));
  const movementNet3 = POSITIONS.map((pos) => normalizedDelta(circularDelta(digitOf(currentDraw, pos), digitOf(thirdDraw, pos), 10), 10));
  const spread = spreadOf(currentDraw) / 9;
  const spreadChange = (spreadOf(currentDraw) - spreadOf(previousDraw)) / 9;
  const repeats = repeatCount(currentDraw) / 3;
  const parity = parityRatio(currentDraw);

  if (profile.variant === "cross" || profile.variant === "regime") {
    const positiveRatio = movementNow.filter((value) => value > 0).length / POSITIONS.length;
    const negativeRatio = movementNow.filter((value) => value < 0).length / POSITIONS.length;
    const flatRatio = movementNow.filter((value) => Math.abs(value) <= 0.2).length / POSITIONS.length;
    return {
      vector: [
        ...movementNow,
        ...movementBefore,
        ...movementNet3,
        acceleration,
        spread,
        spreadChange,
        repeats,
        parity,
        recurrence,
        positiveRatio,
        negativeRatio,
        flatRatio,
      ],
      weights: [
        1.25, 1.25, 1.25, 1.25,
        0.82, 0.82, 0.82, 0.82,
        0.68, 0.68, 0.68, 0.68,
        0.95, 0.38, 0.55, 0.35, 0.24, 0.3,
        profile.variant === "regime" ? 0.8 : 0.35,
        profile.variant === "regime" ? 0.8 : 0.35,
        profile.variant === "regime" ? 0.65 : 0.3,
      ],
      regime,
    };
  }

  const area = profile.areaPositions.length ? profile.areaPositions : POSITIONS;
  const areaNow = area.map((pos) => normalizedDelta(circularDelta(digitOf(currentDraw, pos), digitOf(previousDraw, pos), 10), 10));
  const areaBefore = area.map((pos) => normalizedDelta(circularDelta(digitOf(previousDraw, pos), digitOf(beforeDraw, pos), 10), 10));
  const areaNet3 = area.map((pos) => normalizedDelta(circularDelta(digitOf(currentDraw, pos), digitOf(thirdDraw, pos), 10), 10));
  const left = area[0] ?? "K";
  const right = area[area.length - 1] ?? "E";
  const gapNow = circularDistance(digitOf(currentDraw, left), digitOf(currentDraw, right), 10) / 5;
  const gapBefore = circularDistance(digitOf(previousDraw, left), digitOf(previousDraw, right), 10) / 5;
  const areaSumNow = area.reduce((sum, pos) => sum + digitOf(currentDraw, pos), 0) % 10;
  const areaSumBefore = area.reduce((sum, pos) => sum + digitOf(previousDraw, pos), 0) % 10;
  const areaMovementWeight = Array.from({ length: area.length }, () => 1.25);
  const areaPriorWeight = Array.from({ length: area.length }, () => 0.82);
  const areaNetWeight = Array.from({ length: area.length }, () => 0.7);

  return {
    vector: [
      ...areaNow,
      ...areaBefore,
      ...areaNet3,
      gapNow,
      gapBefore,
      gapNow - gapBefore,
      normalizedDelta(circularDelta(areaSumNow, areaSumBefore, 10), 10),
      spread,
      repeats,
      recurrence,
    ],
    weights: [
      ...areaMovementWeight,
      ...areaPriorWeight,
      ...areaNetWeight,
      0.8, 0.55, 0.72, 0.75, 0.35, 0.32, 0.3,
    ],
    regime,
  };
}

function stateDistance(left: EchoState, right: EchoState, variant: EchoVariant): number {
  const length = Math.min(left.vector.length, right.vector.length, left.weights.length, right.weights.length);
  if (!length) return Number.POSITIVE_INFINITY;
  let weightedSquared = 0;
  let weightTotal = 0;
  for (let index = 0; index < length; index += 1) {
    const weight = (left.weights[index] + right.weights[index]) / 2;
    const difference = left.vector[index] - right.vector[index];
    weightedSquared += weight * difference * difference;
    weightTotal += weight;
  }
  const base = Math.sqrt(weightedSquared / Math.max(weightTotal, 0.0001));
  if (left.regime === right.regime) return Math.max(0, base - 0.035);
  const penalty = variant === "regime" ? 0.34 : variant === "area" ? 0.12 : variant === "cross" ? 0.07 : 0.04;
  return base + penalty;
}

function adaptiveNeighbors(raw: RawNeighbor[], plan: EvaluationPlan, targetIndex: number): RawNeighbor[] {
  const maxNeighbors = Math.min(plan.maximumNeighbors, ABSOLUTE_MAX_NEIGHBORS);
  const eraSize = targetIndex >= 150 ? 20 : 15;
  const sorted = [...raw].sort((left, right) => left.distance - right.distance || right.anchorIndex - left.anchorIndex);
  const selected: RawNeighbor[] = [];
  const eraCounts = new Map<number, number>();

  for (const candidate of sorted) {
    const era = Math.floor(candidate.anchorIndex / eraSize);
    if ((eraCounts.get(era) ?? 0) >= 2) continue;
    if (selected.some((item) => Math.abs(item.anchorIndex - candidate.anchorIndex) <= 1)) continue;
    selected.push(candidate);
    eraCounts.set(era, (eraCounts.get(era) ?? 0) + 1);
    if (selected.length >= maxNeighbors) break;
  }

  if (selected.length < MIN_NEIGHBORS) {
    for (const candidate of sorted) {
      if (selected.includes(candidate)) continue;
      const era = Math.floor(candidate.anchorIndex / eraSize);
      if ((eraCounts.get(era) ?? 0) >= 3) continue;
      selected.push(candidate);
      eraCounts.set(era, (eraCounts.get(era) ?? 0) + 1);
      if (selected.length >= MIN_NEIGHBORS) break;
    }
  }

  if (selected.length < MIN_NEIGHBORS) {
    for (const candidate of sorted) {
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
      if (selected.length >= MIN_NEIGHBORS) break;
    }
  }

  const core = selected.slice(0, MIN_NEIGHBORS);
  const median = core[Math.floor(core.length / 2)]?.distance ?? 1;
  const cutoff = Math.max(median * 1.9, median + 0.14);
  return selected.filter((item, index) => index < MIN_NEIGHBORS || item.distance <= cutoff).slice(0, maxNeighbors);
}

function weightedNeighbors(
  nearest: RawNeighbor[],
  liveAnchor: number,
  liveValue: number,
  modulus: number,
  temperature: number,
  halfLife: number,
): EchoNeighbor[] {
  return nearest.map((neighbor) => {
    const age = liveAnchor - neighbor.anchorIndex;
    const similarity = Math.exp(-neighbor.distance / temperature);
    const recency = Math.pow(0.5, age / halfLife);
    return {
      ...neighbor,
      weight: similarity * recency,
      projectedDigit: circularAdd(liveValue, neighbor.movement, modulus),
    };
  });
}

function voteRanking(neighbors: EchoNeighbor[], modulus: number, take = neighbors.length): Array<{ digit: number; weight: number }> {
  const votes = Array.from({ length: modulus }, () => 0);
  for (const neighbor of neighbors.slice(0, take)) votes[neighbor.projectedDigit] += neighbor.weight;
  return votes.map((weight, digit) => ({ digit, weight })).sort((left, right) => right.weight - left.weight || left.digit - right.digit);
}

function confidenceLevel(confidence: number): EchoConfidenceLevel {
  if (confidence >= 75) return "HIGH";
  if (confidence >= 55) return "MEDIUM";
  return "LOW";
}

function predictAt(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  scanMode: ScanMode,
  target2D: Target2D,
  plan: EvaluationPlan,
): Prediction | null {
  if (targetIndex < MIN_HISTORY || targetIndex > draws.length) return null;
  const liveAnchor = targetIndex - 1;
  if (liveAnchor < STATE_WINDOW - 1) return null;

  const modulus = modulusForMode(scanMode);
  const liveState = buildState(draws, liveAnchor, profile, target2D);
  const liveValue = sourceValue(draws, liveAnchor, profile, target2D);
  const raw: RawNeighbor[] = [];

  for (let anchor = STATE_WINDOW - 1; anchor + 1 < targetIndex; anchor += 1) {
    const state = buildState(draws, anchor, profile, target2D);
    const current = sourceValue(draws, anchor, profile, target2D);
    const next = sourceValue(draws, anchor + 1, profile, target2D);
    raw.push({
      anchorIndex: anchor,
      anchorDraw: draws[anchor],
      nextDraw: draws[anchor + 1],
      distance: stateDistance(liveState, state, profile.variant),
      movement: circularDelta(next, current, modulus),
      regime: state.regime,
    });
  }

  const nearest = adaptiveNeighbors(raw, plan, targetIndex);
  if (nearest.length < MIN_NEIGHBORS) return null;
  const medianDistance = nearest[Math.floor(nearest.length / 2)]?.distance ?? 0.5;
  const temperature = Math.max(0.3, Math.min(0.95, medianDistance * 1.4 + 0.16));
  const middleHalfLife = plan.halfLives[Math.floor(plan.halfLives.length / 2)];
  const baseNeighbors = weightedNeighbors(nearest, liveAnchor, liveValue, modulus, temperature, middleHalfLife);
  const baseRanking = voteRanking(baseNeighbors, modulus);
  const basePatokan = baseRanking[0]?.digit ?? liveValue;
  const kValues = uniqueDigits([
    MIN_NEIGHBORS,
    Math.max(MIN_NEIGHBORS, Math.round((MIN_NEIGHBORS + nearest.length) / 2)),
    nearest.length,
  ]).sort((left, right) => left - right);
  const ensemblePredictions: number[] = [];

  for (const halfLife of plan.halfLives) {
    const weighted = weightedNeighbors(nearest, liveAnchor, liveValue, modulus, temperature, halfLife);
    for (const take of kValues) ensemblePredictions.push(voteRanking(weighted, modulus, take)[0]?.digit ?? basePatokan);
  }

  const predictionCounts = new Map<number, number>();
  for (const digit of ensemblePredictions) predictionCounts.set(digit, (predictionCounts.get(digit) ?? 0) + 1);
  const maxCount = Math.max(...predictionCounts.values());
  const tied = [...predictionCounts.entries()].filter(([, count]) => count === maxCount).map(([digit]) => digit);
  const patokan = tied.includes(basePatokan) ? basePatokan : tied.sort((left, right) => left - right)[0] ?? basePatokan;
  const ensembleStability = ensemblePredictions.length ? (ensemblePredictions.filter((digit) => digit === patokan).length / ensemblePredictions.length) * 100 : 0;

  const voteMap = new Map(baseRanking.map((entry) => [entry.digit, entry.weight]));
  const weightSum = baseNeighbors.reduce((sum, neighbor) => sum + neighbor.weight, 0);
  const weightSquares = baseNeighbors.reduce((sum, neighbor) => sum + neighbor.weight * neighbor.weight, 0);
  const weightedDistance = baseNeighbors.reduce((sum, neighbor) => sum + neighbor.distance * neighbor.weight, 0);
  const sameRegimeWeight = baseNeighbors.filter((neighbor) => neighbor.regime === liveState.regime).reduce((sum, neighbor) => sum + neighbor.weight, 0);
  const dominantShare = weightSum > 0 ? (voteMap.get(patokan) ?? 0) / weightSum : 0;
  const effectiveNeighbors = weightSquares > 0 ? (weightSum * weightSum) / weightSquares : 0;
  const meanDistance = weightSum > 0 ? weightedDistance / weightSum : 1;
  const regimeAgreement = weightSum > 0 ? (sameRegimeWeight / weightSum) * 100 : 0;
  const voteScore = Math.min(1, dominantShare / 0.45);
  const neighborScore = Math.min(1, effectiveNeighbors / 8);
  const similarityScore = Math.exp(-meanDistance);
  const confidence = Math.round((
    0.25 * voteScore +
    0.2 * neighborScore +
    0.2 * similarityScore +
    0.25 * (ensembleStability / 100) +
    0.1 * (regimeAgreement / 100)
  ) * 100);

  return {
    patokan,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    quality: {
      neighborCount: baseNeighbors.length,
      effectiveNeighbors: Number(effectiveNeighbors.toFixed(2)),
      meanDistance: Number(meanDistance.toFixed(3)),
      dominantShare: Number((dominantShare * 100).toFixed(1)),
      stability: Number(ensembleStability.toFixed(1)),
      ensembleStability: Number(ensembleStability.toFixed(1)),
      regimeAgreement: Number(regimeAgreement.toFixed(1)),
      regime: liveState.regime,
    },
    neighbors: baseNeighbors,
  };
}

function columnsForMode(scanMode: ScanMode): readonly Kolom[] {
  return isShioMode(scanMode) ? SHIO_KOLOM : KOLOM;
}

function deretForMode(patokan: number, scanMode: ScanMode): number[] {
  return isShioMode(scanMode) ? buildDeretShio(patokan) : buildDeret(patokan);
}

function targetColumnsForRow(deret: number[], targetDigits: number[], scanMode: ScanMode): Kolom[] {
  const columns = columnsForMode(scanMode);
  return uniqueDigits(targetDigits)
    .map((digit) => columns[deret.indexOf(digit)])
    .filter((column): column is Kolom => Boolean(column));
}

function requiredCover(scanMode: ScanMode, targetColumns: Kolom[]): number {
  if (scanMode === "ai_2d_belakang") return Math.min(1, targetColumns.length);
  if (scanMode === "ai_3d") return Math.min(2, targetColumns.length);
  return targetColumns.length;
}

function rowCovered(targetColumns: Kolom[], selected: Set<Kolom>, scanMode: ScanMode): boolean {
  if (isOffMode(scanMode)) return targetColumns.every((column) => !selected.has(column));
  return targetColumns.filter((column) => selected.has(column)).length >= requiredCover(scanMode, targetColumns);
}

function combinations<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  const current: T[] = [];
  function walk(start: number) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let index = start; index < values.length; index += 1) {
      current.push(values[index]);
      walk(index + 1);
      current.pop();
    }
  }
  walk(0);
  return result;
}

function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const safeK = Math.min(k, n - k);
  let result = 1;
  for (let index = 1; index <= safeK; index += 1) result = (result * (n - safeK + index)) / index;
  return result;
}

function randomCoverageProbability(total: number, selected: number, targets: number, required: number, offMode: boolean): number {
  const denominator = combination(total, selected);
  if (!denominator || targets <= 0) return 0;
  if (offMode) return combination(total - targets, selected) / denominator;
  let probability = 0;
  for (let hits = required; hits <= Math.min(targets, selected); hits += 1) {
    probability += combination(targets, hits) * combination(total - targets, selected - hits) / denominator;
  }
  return probability;
}

function baselineRate(rows: EchoBacktestRow[], digitCount: number, scanMode: ScanMode): number {
  const totalColumns = columnsForMode(scanMode).length;
  if (!rows.length) return 0;
  const probabilities = rows.map((row) => randomCoverageProbability(
    totalColumns,
    digitCount,
    row.targetColumns.length,
    requiredCover(scanMode, row.targetColumns),
    isOffMode(scanMode),
  ));
  return Number((mean(probabilities) * 100).toFixed(1));
}

function longestMissStreak(statuses: boolean[]): number {
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

function rateOf(statuses: boolean[]): number {
  return statuses.length ? Number(((statuses.filter(Boolean).length / statuses.length) * 100).toFixed(1)) : 0;
}

function discoveryAudit(statuses: boolean[], windowsSpec: WindowSpec[]) {
  const windows: EchoWindowAudit[] = windowsSpec.map(({ size, weight }) => {
    const sample = statuses.slice(-Math.min(size, statuses.length));
    return {
      window: size,
      weight,
      hit: sample.filter(Boolean).length,
      total: sample.length,
      rate: rateOf(sample),
      longestMissStreak: longestMissStreak(sample),
    };
  }).filter((window) => window.total > 0);
  const totalWeight = windows.reduce((sum, window) => sum + window.weight, 0);
  const weightedAccuracy = totalWeight ? windows.reduce((sum, window) => sum + window.rate * window.weight, 0) / totalWeight : 0;
  const rates = windows.map((window) => window.rate);
  const stability = rates.length ? Math.max(0, 100 - (Math.max(...rates) - Math.min(...rates))) : 0;
  const strongest = [...windows].sort((left, right) => right.rate - left.rate || left.window - right.window)[0];
  const weakest = [...windows].sort((left, right) => left.rate - right.rate || right.window - left.window)[0];
  return {
    windows,
    weightedAccuracy: Number(weightedAccuracy.toFixed(1)),
    stability: Number(stability.toFixed(1)),
    strongestWindow: strongest?.window ?? 0,
    weakestWindow: weakest?.window ?? 0,
  };
}

function weightedDiscoveryBaseline(rows: EchoBacktestRow[], digitCount: number, scanMode: ScanMode, windowsSpec: WindowSpec[]): number {
  const windows = windowsSpec.map((window) => ({
    weight: window.weight,
    baseline: baselineRate(rows.slice(-Math.min(window.size, rows.length)), digitCount, scanMode),
  }));
  const weightTotal = windows.reduce((sum, window) => sum + window.weight, 0);
  return weightTotal ? Number((windows.reduce((sum, window) => sum + window.baseline * window.weight, 0) / weightTotal).toFixed(1)) : 0;
}

function weakestRate(windows: EchoWindowAudit[]): number {
  return windows.reduce((minimum, window) => Math.min(minimum, window.rate), 100);
}

function selectColumns(rows: EchoBacktestRow[], digitCount: number, scanMode: ScanMode, plan: EvaluationPlan): ColumnSelection | null {
  const available = columnsForMode(scanMode);
  if (digitCount < 1 || digitCount > available.length || rows.length < plan.totalRows) return null;
  const discoveryRows = rows.slice(0, plan.discoverySize);
  const validationRows = rows.slice(plan.discoverySize, plan.discoverySize + plan.validationSize);
  const holdoutRows = rows.slice(plan.discoverySize + plan.validationSize, plan.totalRows);
  let best: ColumnSelection | null = null;

  for (const columns of combinations(available, digitCount)) {
    const selected = new Set<Kolom>(columns);
    const discoveryStatuses = discoveryRows.map((row) => rowCovered(row.targetColumns, selected, scanMode));
    const validationStatuses = validationRows.map((row) => rowCovered(row.targetColumns, selected, scanMode));
    const holdoutStatuses = holdoutRows.map((row) => rowCovered(row.targetColumns, selected, scanMode));
    const allStatuses = [...discoveryStatuses, ...validationStatuses, ...holdoutStatuses];
    const discoveryWindows = discoveryAudit(discoveryStatuses, plan.discoveryWindows);
    const discoveryBaselineRate = weightedDiscoveryBaseline(discoveryRows, digitCount, scanMode, plan.discoveryWindows);
    const validationBaselineRate = baselineRate(validationRows, digitCount, scanMode);
    const holdoutBaselineRate = baselineRate(holdoutRows, digitCount, scanMode);
    const validationRate = rateOf(validationStatuses);
    const holdoutRate = rateOf(holdoutStatuses);
    const recentStatuses = holdoutStatuses.slice(-RECENT_SIZE);
    const columnUsage = discoveryRows.reduce((sum, row) => sum + row.targetColumns.filter((column) => selected.has(column)).length, 0);
    const efficiency = columnUsage / Math.max(1, discoveryRows.length * columns.length);
    const audit: EchoAudit = {
      discoveryHit: discoveryStatuses.filter(Boolean).length,
      discoveryTotal: discoveryStatuses.length,
      discoveryRate: rateOf(discoveryStatuses),
      discoveryWeightedAccuracy: discoveryWindows.weightedAccuracy,
      discoveryBaselineRate,
      discoveryLift: Number((discoveryWindows.weightedAccuracy - discoveryBaselineRate).toFixed(1)),
      discoveryWindowStability: discoveryWindows.stability,
      strongestWindow: discoveryWindows.strongestWindow,
      weakestWindow: discoveryWindows.weakestWindow,
      windows: discoveryWindows.windows,
      validationHit: validationStatuses.filter(Boolean).length,
      validationTotal: validationStatuses.length,
      validationRate,
      validationBaselineRate,
      validationLift: Number((validationRate - validationBaselineRate).toFixed(1)),
      holdoutHit: holdoutStatuses.filter(Boolean).length,
      holdoutTotal: holdoutStatuses.length,
      holdoutRate,
      holdoutBaselineRate,
      holdoutLift: Number((holdoutRate - holdoutBaselineRate).toFixed(1)),
      recentHit: recentStatuses.filter(Boolean).length,
      recentTotal: recentStatuses.length,
      longestMissStreak: longestMissStreak(allStatuses),
    };
    const selectedRows = rows.map((row, index) => ({ ...row, covered: allStatuses[index] ?? false }));
    const candidate: ColumnSelection = { columns: [...columns], audit, rows: selectedRows, efficiency };

    if (!best ||
      candidate.audit.discoveryWeightedAccuracy > best.audit.discoveryWeightedAccuracy ||
      (candidate.audit.discoveryWeightedAccuracy === best.audit.discoveryWeightedAccuracy && weakestRate(candidate.audit.windows) > weakestRate(best.audit.windows)) ||
      (candidate.audit.discoveryWeightedAccuracy === best.audit.discoveryWeightedAccuracy && weakestRate(candidate.audit.windows) === weakestRate(best.audit.windows) && candidate.audit.discoveryWindowStability > best.audit.discoveryWindowStability) ||
      (candidate.audit.discoveryWeightedAccuracy === best.audit.discoveryWeightedAccuracy && weakestRate(candidate.audit.windows) === weakestRate(best.audit.windows) && candidate.audit.discoveryWindowStability === best.audit.discoveryWindowStability && candidate.audit.longestMissStreak < best.audit.longestMissStreak) ||
      (candidate.audit.discoveryWeightedAccuracy === best.audit.discoveryWeightedAccuracy && weakestRate(candidate.audit.windows) === weakestRate(best.audit.windows) && candidate.audit.discoveryWindowStability === best.audit.discoveryWindowStability && candidate.audit.longestMissStreak === best.audit.longestMissStreak && candidate.efficiency > best.efficiency) ||
      (candidate.audit.discoveryWeightedAccuracy === best.audit.discoveryWeightedAccuracy && weakestRate(candidate.audit.windows) === weakestRate(best.audit.windows) && candidate.audit.discoveryWindowStability === best.audit.discoveryWindowStability && candidate.audit.longestMissStreak === best.audit.longestMissStreak && candidate.efficiency === best.efficiency && columns.join("") < best.columns.join(""))) {
      best = candidate;
    }
  }
  return best;
}

function buildProfiles(scanMode: ScanMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D): EchoProfile[] {
  const profiles: EchoProfile[] = [];
  const area = areaForMode(scanMode, target2D, target3D);
  const add = (family: EchoFamily, variant: EchoVariant, formula: string, anchorPos: Posisi | null, sourceKind: EchoProfile["sourceKind"]) => {
    profiles.push({ family, variant, formula, anchorPos, sourceKind, areaPositions: area });
  };

  if (isShioMode(scanMode)) {
    add("ES", "local", `ES-L-${target2D[0].toUpperCase()}`, null, "shio");
    add("ES", "cross", `ES-X-${target2D[0].toUpperCase()}`, null, "shio");
    add("ES", "regime", `ES-R-${target2D[0].toUpperCase()}`, null, "shio");
    return profiles;
  }
  if (isJumlah2DMode(scanMode)) {
    add("EJ", "local", `EJ-L-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("EJ", "cross", `EJ-X-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("EJ", "regime", `EJ-R-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("EJ", "area", `EJ-A-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    return profiles;
  }

  const anchors = scanMode === "posisi" || scanMode === "off_posisi" ? [targetPos] : area;
  const areaCode = is3DMode(scanMode) ? `3${target3D[0].toUpperCase()}` : target2D[0].toUpperCase();
  for (const anchor of anchors) {
    add("EL", "local", `EL-${anchor}`, anchor, "position");
    add("EX", "cross", `EX-${anchor}`, anchor, "position");
    add("ER", "regime", `ER-${anchor}`, anchor, "position");
    if (area.length) add("EA", "area", `EA-${areaCode}-${anchor}`, anchor, "position");
  }
  return profiles;
}

function backtestRows(
  draws: Draw[],
  profile: EchoProfile,
  scanMode: ScanMode,
  targetPos: Posisi,
  target2D: Target2D,
  target3D: Target3D,
  plan: EvaluationPlan,
): EchoBacktestRow[] {
  const start = Math.max(MIN_HISTORY, draws.length - plan.totalRows);
  const rows: EchoBacktestRow[] = [];
  for (let targetIndex = start; targetIndex < draws.length; targetIndex += 1) {
    const prediction = predictAt(draws, targetIndex, profile, scanMode, target2D, plan);
    if (!prediction) continue;
    const deret = deretForMode(prediction.patokan, scanMode);
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
      confidence: prediction.confidence,
      effectiveNeighbors: prediction.quality.effectiveNeighbors,
    });
  }
  return rows.slice(-plan.totalRows);
}

function normalizedReliability(rate: number, baseline: number): number {
  const lift = rate - baseline;
  if (lift >= 0) return Math.min(1, 0.5 + 0.5 * (lift / Math.max(1, 100 - baseline)));
  return Math.max(0, 0.5 + 0.5 * (lift / Math.max(1, baseline)));
}

function baseScore(selection: ColumnSelection, confidence: number, quality: EchoQuality): number {
  const discoveryReliability = 0.65 * normalizedReliability(selection.audit.discoveryWeightedAccuracy, selection.audit.discoveryBaselineRate) + 0.35 * (selection.audit.discoveryWeightedAccuracy / 100);
  const validationReliability = 0.7 * normalizedReliability(selection.audit.validationRate, selection.audit.validationBaselineRate) + 0.3 * (selection.audit.validationRate / 100);
  const stability = ((quality.ensembleStability * 0.55) + (selection.audit.discoveryWindowStability * 0.45)) / 100;
  let score = (
    0.28 * discoveryReliability +
    0.32 * validationReliability +
    0.18 * (confidence / 100) +
    0.14 * stability +
    0.08 * Math.min(1, selection.efficiency)
  ) * 100;
  if (quality.effectiveNeighbors < 6.5) score -= 10;
  if (confidence < 50) score -= 6;
  if (selection.audit.validationLift < -5) score -= 10;
  if (selection.audit.discoveryWindowStability < 60) score -= 5;
  if (selection.audit.longestMissStreak > 4) score -= 5;
  return Number(Math.max(0, score).toFixed(2));
}

function overlapRatio(left: number[], right: number[]): number {
  const leftSet = new Set(left);
  return uniqueDigits(right).filter((digit) => leftSet.has(digit)).length / Math.max(1, Math.min(uniqueDigits(left).length, uniqueDigits(right).length));
}

function addConsensus(items: EchoItem[]): EchoItem[] {
  const families = new Set(items.map((item) => item.family));
  return items.map((item) => {
    const support = new Set<EchoFamily>([item.family]);
    for (const other of items) {
      if (other === item || other.family === item.family) continue;
      if (overlapRatio(item.angkaHidup, other.angkaHidup) >= 0.5) support.add(other.family);
    }
    const familyAgreement = families.size ? Number(((support.size / families.size) * 100).toFixed(1)) : 0;
    return {
      ...item,
      familyAgreement,
      consensusFamilies: [...support].sort(),
      score: Number(Math.min(100, item.score + familyAgreement * 0.06).toFixed(2)),
    };
  });
}

function strengthOf(item: EchoItem): EchoStrength {
  if (item.score >= 72 && item.audit.validationLift >= 5 && item.audit.holdoutLift >= 3 && item.confidence >= 60) return "KUAT";
  if (item.score >= 58 && item.audit.validationLift >= 0 && item.audit.holdoutLift >= -3 && item.confidence >= 50) return "CUKUP";
  return "PANTAU";
}

function passesMinimumSignal(item: EchoItem): boolean {
  return item.score >= 45 &&
    item.confidence >= 42 &&
    item.echo.effectiveNeighbors >= 5 &&
    item.audit.validationLift >= -15 &&
    item.audit.holdoutLift >= -20;
}

export function runEcho(draws: Draw[], config: EchoConfig): EchoResult {
  if (draws.length < MIN_TOTAL_DATA) throw new Error(`Data belum cukup. Echo Engine membutuhkan minimal ${MIN_TOTAL_DATA} result.`);

  const plan = evaluationPlan(draws.length);
  const scanMode = scanModeOrDefault(config.scanMode);
  const targetPos = config.targetPos ?? "K";
  const target2D = target2DOrDefault(config.target2D);
  const target3D = target3DOrDefault(config.target3D);
  const digitCount = clamp(config.digitCount, 4, 1, isShioMode(scanMode) ? 12 : 9);
  const profiles = buildProfiles(scanMode, targetPos, target2D, target3D);
  const candidates: EchoItem[] = [];

  for (const profile of profiles) {
    const rows = backtestRows(draws, profile, scanMode, targetPos, target2D, target3D, plan);
    const selection = selectColumns(rows, digitCount, scanMode, plan);
    const live = predictAt(draws, draws.length, profile, scanMode, target2D, plan);
    if (!selection || !live) continue;

    const deretLive = deretForMode(live.patokan, scanMode);
    const sourceColumns = columnsForMode(scanMode);
    const selectedSet = new Set(selection.columns);
    const angkaHidup = selection.columns.map((column) => deretLive[sourceColumns.indexOf(column)]).filter((digit): digit is number => Number.isFinite(digit));
    const kolomMati = sourceColumns.filter((column) => !selectedSet.has(column));
    const angkaMati = kolomMati.map((column) => deretLive[sourceColumns.indexOf(column)]).filter((digit): digit is number => Number.isFinite(digit));

    candidates.push({
      family: profile.family,
      formula: profile.formula,
      anchorPos: profile.anchorPos,
      targetPos,
      target2D,
      target3D,
      scanMode,
      angkaHidup,
      angkaMati,
      kolomHidup: selection.columns,
      kolomMati: [...kolomMati],
      activeColumns: selection.columns.join(""),
      score: baseScore(selection, live.confidence, live.quality),
      strength: "PANTAU",
      confidence: live.confidence,
      confidenceLevel: live.confidenceLevel,
      familyAgreement: 0,
      consensusFamilies: [profile.family],
      audit: selection.audit,
      echo: live.quality,
      result: {
        latestDraw: draws[draws.length - 1],
        patokan: live.patokan,
        deretLive,
        rows: selection.rows,
        neighbors: live.neighbors,
      },
    });
  }

  const deduped = new Map<string, EchoItem>();
  for (const item of candidates) {
    const signature = `${item.scanMode}:${item.targetPos}:${item.target2D}:${item.target3D}:${[...item.angkaHidup].sort((left, right) => left - right).join("")}`;
    const previous = deduped.get(signature);
    if (!previous || item.score > previous.score) deduped.set(signature, item);
  }

  const ranked = addConsensus([...deduped.values()]).sort((left, right) =>
    right.score - left.score ||
    right.audit.validationLift - left.audit.validationLift ||
    right.familyAgreement - left.familyAgreement ||
    right.confidence - left.confidence ||
    left.formula.localeCompare(right.formula)
  );
  const top = ranked[0] ? { ...ranked[0], strength: strengthOf(ranked[0]) } : null;
  const accepted = top && passesMinimumSignal(top) ? [top] : [];
  const message = accepted.length
    ? `Satu rekomendasi dipilih dari ${ranked.length} kandidat tanpa memakai final holdout untuk menentukan profile.`
    : "Sinyal Echo saat ini berada di bawah batas minimum. Engine tidak memaksakan rekomendasi.";

  return {
    config: {
      targetPos,
      target2D,
      target3D,
      digitCount,
      scanMode,
      discoveryWindows: plan.discoveryWindows.map((window) => window.size),
      validationSize: plan.validationSize,
      holdoutSize: plan.holdoutSize,
      evaluationRows: plan.totalRows,
      sourceDataSize: draws.length,
    },
    totalProfiles: profiles.length,
    totalQualified: ranked.length,
    message,
    items: accepted,
  };
}

export const ECHO_INTERNAL_CONFIG = {
  stateWindow: STATE_WINDOW,
  minimumHistory: MIN_HISTORY,
  minimumTotalData: MIN_TOTAL_DATA,
  minimumNeighbors: MIN_NEIGHBORS,
  maximumNeighbors: ABSOLUTE_MAX_NEIGHBORS,
  recentSize: RECENT_SIZE,
};
