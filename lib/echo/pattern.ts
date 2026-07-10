import {
  digitOf,
  isShioMode,
  jumlah2dDigit,
  target2DPositions,
  targetShioIndexOf,
  uniqueDigits,
} from "../engine/helpers";
import type { Draw, Posisi, ScanMode, Target2D } from "../engine/types";
import {
  ECHO_MAX_NEIGHBORS,
  ECHO_MIN_HISTORY,
  ECHO_MIN_NEIGHBORS,
  ECHO_STATE_WINDOW,
  type EchoEvaluationPlan,
} from "./config";
import type {
  EchoConfidenceLevel,
  EchoNeighbor,
  EchoProfile,
  EchoQuality,
  EchoRegime,
  EchoVariant,
} from "./types";

const POSITIONS: Posisi[] = ["A", "C", "K", "E"];

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

export interface EchoPrediction {
  patokan: number;
  confidence: number;
  confidenceLevel: EchoConfidenceLevel;
  quality: EchoQuality;
  neighbors: EchoNeighbor[];
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
      ...Array.from({ length: area.length }, () => 1.25),
      ...Array.from({ length: area.length }, () => 0.82),
      ...Array.from({ length: area.length }, () => 0.7),
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

function adaptiveNeighbors(raw: RawNeighbor[], plan: EchoEvaluationPlan, targetIndex: number): RawNeighbor[] {
  const maxNeighbors = Math.min(plan.maximumNeighbors, ECHO_MAX_NEIGHBORS);
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

  if (selected.length < ECHO_MIN_NEIGHBORS) {
    for (const candidate of sorted) {
      if (selected.includes(candidate)) continue;
      const era = Math.floor(candidate.anchorIndex / eraSize);
      if ((eraCounts.get(era) ?? 0) >= 3) continue;
      selected.push(candidate);
      eraCounts.set(era, (eraCounts.get(era) ?? 0) + 1);
      if (selected.length >= ECHO_MIN_NEIGHBORS) break;
    }
  }

  if (selected.length < ECHO_MIN_NEIGHBORS) {
    for (const candidate of sorted) {
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
      if (selected.length >= ECHO_MIN_NEIGHBORS) break;
    }
  }

  const core = selected.slice(0, ECHO_MIN_NEIGHBORS);
  const median = core[Math.floor(core.length / 2)]?.distance ?? 1;
  const cutoff = Math.max(median * 1.9, median + 0.14);
  return selected.filter((item, index) => index < ECHO_MIN_NEIGHBORS || item.distance <= cutoff).slice(0, maxNeighbors);
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

export function predictEchoAt(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  scanMode: ScanMode,
  target2D: Target2D,
  plan: EchoEvaluationPlan,
): EchoPrediction | null {
  if (targetIndex < ECHO_MIN_HISTORY || targetIndex > draws.length) return null;
  const liveAnchor = targetIndex - 1;
  if (liveAnchor < ECHO_STATE_WINDOW - 1) return null;

  const modulus = modulusForMode(scanMode);
  const liveState = buildState(draws, liveAnchor, profile, target2D);
  const liveValue = sourceValue(draws, liveAnchor, profile, target2D);
  const raw: RawNeighbor[] = [];

  for (let anchor = ECHO_STATE_WINDOW - 1; anchor + 1 < targetIndex; anchor += 1) {
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
  if (nearest.length < ECHO_MIN_NEIGHBORS) return null;
  const medianDistance = nearest[Math.floor(nearest.length / 2)]?.distance ?? 0.5;
  const temperature = Math.max(0.3, Math.min(0.95, medianDistance * 1.4 + 0.16));
  const middleHalfLife = plan.halfLives[Math.floor(plan.halfLives.length / 2)];
  const baseNeighbors = weightedNeighbors(nearest, liveAnchor, liveValue, modulus, temperature, middleHalfLife);
  const baseRanking = voteRanking(baseNeighbors, modulus);
  const basePatokan = baseRanking[0]?.digit ?? liveValue;
  const kValues = uniqueDigits([
    ECHO_MIN_NEIGHBORS,
    Math.max(ECHO_MIN_NEIGHBORS, Math.round((ECHO_MIN_NEIGHBORS + nearest.length) / 2)),
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
  const ensembleStability = ensemblePredictions.length
    ? (ensemblePredictions.filter((digit) => digit === patokan).length / ensemblePredictions.length) * 100
    : 0;

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
