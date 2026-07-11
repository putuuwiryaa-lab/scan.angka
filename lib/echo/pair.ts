import {
  digitOf,
  is3DMode,
  isJumlah2DMode,
  isShioMode,
  target2DPositions,
  target3DPositions,
  targetDigitsOf,
  uniqueDigits,
} from "../engine/helpers";
import type { Draw, Kolom, Posisi, ScanMode, Target2D, Target3D } from "../engine/types";
import { echoColumnsForMode, echoDeretForMode } from "./audit";
import {
  ECHO_MAX_NEIGHBORS,
  ECHO_MIN_HISTORY,
  ECHO_MIN_NEIGHBORS,
  type EchoEvaluationPlan,
} from "./config";
import type { EchoPrediction } from "./pattern";
import type {
  EchoBacktestRow,
  EchoConfidenceLevel,
  EchoNeighbor,
  EchoProfile,
  EchoRegime,
} from "./types";

type PairState = {
  vector: number[];
  weights: number[];
  regime: EchoRegime;
};

type RawPairNeighbor = {
  anchorIndex: number;
  anchorDraw: Draw;
  nextDraw: Draw;
  distance: number;
  movement: number;
  regime: EchoRegime;
};

function circularDelta(current: number, previous: number, modulus = 10): number {
  const raw = ((current - previous) % modulus + modulus) % modulus;
  return raw > modulus / 2 ? raw - modulus : raw;
}

function circularDistance(left: number, right: number, modulus = 10): number {
  return Math.abs(circularDelta(left, right, modulus));
}

function circularAdd(value: number, movement: number, modulus = 10): number {
  return ((value + movement) % modulus + modulus) % modulus;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function areaPositions(profile: EchoProfile): Posisi[] {
  return profile.areaPositions.length >= 2 ? profile.areaPositions : ["K", "E"];
}

function valuesOf(draw: Draw, positions: Posisi[]): number[] {
  return positions.map((position) => digitOf(draw, position));
}

function adjacentGaps(values: number[]): number[] {
  const gaps: number[] = [];
  for (let index = 0; index + 1 < values.length; index += 1) {
    gaps.push(circularDistance(values[index], values[index + 1], 10) / 5);
  }
  return gaps;
}

function movementVector(current: Draw, previous: Draw, positions: Posisi[]): number[] {
  return positions.map((position) => (
    circularDelta(digitOf(current, position), digitOf(previous, position), 10) / 5
  ));
}

function spread(values: number[]): number {
  return values.length ? (Math.max(...values) - Math.min(...values)) / 9 : 0;
}

function repeatRatio(values: number[]): number {
  return values.length > 1 ? (values.length - new Set(values).size) / (values.length - 1) : 0;
}

function parityRatio(values: number[]): number {
  return values.length ? values.filter((value) => value % 2 === 0).length / values.length : 0;
}

function sumDigit(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) % 10;
}

function classifyPairRegime(current: number[], previous: number[]): EchoRegime {
  const currentSpread = spread(current);
  const previousSpread = spread(previous);
  const currentRepeat = repeatRatio(current);
  const previousRepeat = repeatRatio(previous);
  const movements = current.map((value, index) => circularDelta(value, previous[index], 10));
  const reversals = movements.filter((movement, index) => {
    if (index === 0 || movement === 0 || movements[index - 1] === 0) return false;
    return Math.sign(movement) !== Math.sign(movements[index - 1]);
  }).length;

  if (currentRepeat > previousRepeat) return "REPEAT";
  if (reversals >= Math.max(1, current.length - 1)) return "ZIGZAG";
  if (currentSpread > previousSpread + 0.2) return "EXPANDING";
  if (currentSpread + 0.2 < previousSpread) return "COMPRESSING";
  if (movements.every((movement) => movement >= 0) && movements.some((movement) => movement > 0)) return "TREND_UP";
  if (movements.every((movement) => movement <= 0) && movements.some((movement) => movement < 0)) return "TREND_DOWN";
  if (movements.every((movement) => Math.abs(movement) <= 1)) return "FLAT";
  return "MIXED";
}

function buildPairState(draws: Draw[], index: number, profile: EchoProfile): PairState {
  const positions = areaPositions(profile);
  const current = valuesOf(draws[index], positions);
  const previous = valuesOf(draws[index - 1], positions);
  const before = valuesOf(draws[index - 2], positions);
  const currentGaps = adjacentGaps(current);
  const previousGaps = adjacentGaps(previous);
  const gapChanges = currentGaps.map((gap, gapIndex) => gap - (previousGaps[gapIndex] ?? 0));
  const currentMovements = movementVector(draws[index], draws[index - 1], positions);
  const previousMovements = movementVector(draws[index - 1], draws[index - 2], positions);
  const currentSum = sumDigit(current);
  const previousSum = sumDigit(previous);
  const beforeSum = sumDigit(before);
  const sumMovement = circularDelta(currentSum, previousSum, 10) / 5;
  const priorSumMovement = circularDelta(previousSum, beforeSum, 10) / 5;
  const regime = classifyPairRegime(current, previous);

  if (profile.variant === "pairGap") {
    return {
      vector: [
        ...currentGaps,
        ...previousGaps,
        ...gapChanges,
        spread(current),
        spread(previous),
        repeatRatio(current),
        ...currentMovements,
      ],
      weights: [
        ...Array.from({ length: currentGaps.length }, () => 1.45),
        ...Array.from({ length: previousGaps.length }, () => 0.9),
        ...Array.from({ length: gapChanges.length }, () => 1.1),
        0.7,
        0.45,
        0.55,
        ...Array.from({ length: currentMovements.length }, () => 0.65),
      ],
      regime,
    };
  }

  if (profile.variant === "pairSum") {
    return {
      vector: [
        currentSum / 9,
        previousSum / 9,
        sumMovement,
        priorSumMovement,
        sumMovement - priorSumMovement,
        parityRatio(current),
        parityRatio(previous),
        repeatRatio(current),
        spread(current),
        ...currentMovements,
      ],
      weights: [1.3, 0.8, 1.25, 0.72, 0.9, 0.45, 0.3, 0.5, 0.45, ...Array.from({ length: currentMovements.length }, () => 0.8)],
      regime,
    };
  }

  return {
    vector: [
      ...currentGaps,
      ...previousGaps,
      ...gapChanges,
      currentSum / 9,
      previousSum / 9,
      sumMovement,
      priorSumMovement,
      parityRatio(current),
      parityRatio(previous),
      repeatRatio(current),
      repeatRatio(previous),
      spread(current),
      spread(previous),
      ...currentMovements,
      ...previousMovements,
    ],
    weights: [
      ...Array.from({ length: currentGaps.length }, () => 1.2),
      ...Array.from({ length: previousGaps.length }, () => 0.75),
      ...Array.from({ length: gapChanges.length }, () => 0.9),
      0.8,
      0.5,
      0.95,
      0.55,
      0.35,
      0.25,
      0.45,
      0.3,
      0.55,
      0.35,
      ...Array.from({ length: currentMovements.length }, () => 0.8),
      ...Array.from({ length: previousMovements.length }, () => 0.45),
    ],
    regime,
  };
}

function stateDistance(left: PairState, right: PairState): number {
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
  return left.regime === right.regime ? Math.max(0, base - 0.04) : base + 0.08;
}

function selectNeighbors(raw: RawPairNeighbor[], plan: EchoEvaluationPlan, targetIndex: number): RawPairNeighbor[] {
  const maximum = Math.min(plan.maximumNeighbors, ECHO_MAX_NEIGHBORS);
  const eraSize = targetIndex >= 150 ? 20 : 15;
  const sorted = [...raw].sort((left, right) => left.distance - right.distance || right.anchorIndex - left.anchorIndex);
  const selected: RawPairNeighbor[] = [];
  const eraCounts = new Map<number, number>();

  for (const candidate of sorted) {
    const era = Math.floor(candidate.anchorIndex / eraSize);
    if ((eraCounts.get(era) ?? 0) >= 2) continue;
    if (selected.some((item) => Math.abs(item.anchorIndex - candidate.anchorIndex) <= 1)) continue;
    selected.push(candidate);
    eraCounts.set(era, (eraCounts.get(era) ?? 0) + 1);
    if (selected.length >= maximum) break;
  }

  if (selected.length < ECHO_MIN_NEIGHBORS) {
    for (const candidate of sorted) {
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
      if (selected.length >= ECHO_MIN_NEIGHBORS) break;
    }
  }

  const core = selected.slice(0, ECHO_MIN_NEIGHBORS);
  const medianDistance = core[Math.floor(core.length / 2)]?.distance ?? 1;
  const cutoff = Math.max(medianDistance * 1.9, medianDistance + 0.12);
  return selected
    .filter((neighbor, index) => index < ECHO_MIN_NEIGHBORS || neighbor.distance <= cutoff)
    .slice(0, maximum);
}

function weightedNeighbors(
  neighbors: RawPairNeighbor[],
  liveAnchor: number,
  liveValue: number,
  temperature: number,
  halfLife: number,
): EchoNeighbor[] {
  return neighbors.map((neighbor) => {
    const age = liveAnchor - neighbor.anchorIndex;
    const similarity = Math.exp(-neighbor.distance / temperature);
    const recency = Math.pow(0.5, age / halfLife);
    return {
      ...neighbor,
      weight: similarity * recency,
      projectedDigit: circularAdd(liveValue, neighbor.movement, 10),
    };
  });
}

function voteRanking(neighbors: EchoNeighbor[], take = neighbors.length): Array<{ digit: number; weight: number }> {
  const votes = Array.from({ length: 10 }, () => 0);
  for (const neighbor of neighbors.slice(0, take)) votes[neighbor.projectedDigit] += neighbor.weight;
  return votes
    .map((weight, digit) => ({ digit, weight }))
    .sort((left, right) => right.weight - left.weight || left.digit - right.digit);
}

function confidenceLevel(confidence: number): EchoConfidenceLevel {
  if (confidence >= 75) return "HIGH";
  if (confidence >= 55) return "MEDIUM";
  return "LOW";
}

export function predictPairAt(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  plan: EchoEvaluationPlan,
): EchoPrediction | null {
  if (targetIndex < ECHO_MIN_HISTORY || targetIndex > draws.length) return null;
  const liveAnchor = targetIndex - 1;
  if (liveAnchor < 3) return null;

  const positions = areaPositions(profile);
  const sourcePosition = profile.anchorPos ?? positions[0] ?? "K";
  const liveValue = digitOf(draws[liveAnchor], sourcePosition);
  const liveState = buildPairState(draws, liveAnchor, profile);
  const raw: RawPairNeighbor[] = [];

  for (let anchor = 2; anchor + 1 < targetIndex; anchor += 1) {
    const current = digitOf(draws[anchor], sourcePosition);
    const next = digitOf(draws[anchor + 1], sourcePosition);
    raw.push({
      anchorIndex: anchor,
      anchorDraw: draws[anchor],
      nextDraw: draws[anchor + 1],
      distance: stateDistance(liveState, buildPairState(draws, anchor, profile)),
      movement: circularDelta(next, current, 10),
      regime: buildPairState(draws, anchor, profile).regime,
    });
  }

  const nearest = selectNeighbors(raw, plan, targetIndex);
  if (nearest.length < ECHO_MIN_NEIGHBORS) return null;

  const medianDistance = nearest[Math.floor(nearest.length / 2)]?.distance ?? 0.5;
  const temperature = Math.max(0.18, Math.min(0.9, medianDistance * 1.35 + 0.12));
  const middleHalfLife = plan.halfLives[Math.floor(plan.halfLives.length / 2)];
  const baseNeighbors = weightedNeighbors(nearest, liveAnchor, liveValue, temperature, middleHalfLife);
  const baseRanking = voteRanking(baseNeighbors);
  const basePatokan = baseRanking[0]?.digit ?? liveValue;
  const kValues = uniqueDigits([
    ECHO_MIN_NEIGHBORS,
    Math.max(ECHO_MIN_NEIGHBORS, Math.round((ECHO_MIN_NEIGHBORS + nearest.length) / 2)),
    nearest.length,
  ]).sort((left, right) => left - right);
  const ensemblePredictions: number[] = [];

  for (const halfLife of plan.halfLives) {
    const weighted = weightedNeighbors(nearest, liveAnchor, liveValue, temperature, halfLife);
    for (const take of kValues) ensemblePredictions.push(voteRanking(weighted, take)[0]?.digit ?? basePatokan);
  }

  const predictionCounts = new Map<number, number>();
  for (const digit of ensemblePredictions) predictionCounts.set(digit, (predictionCounts.get(digit) ?? 0) + 1);
  const maximumCount = Math.max(...predictionCounts.values());
  const tied = [...predictionCounts.entries()]
    .filter(([, count]) => count === maximumCount)
    .map(([digit]) => digit);
  const patokan = tied.includes(basePatokan) ? basePatokan : tied.sort((left, right) => left - right)[0] ?? basePatokan;
  const ensembleStability = ensemblePredictions.length
    ? (ensemblePredictions.filter((digit) => digit === patokan).length / ensemblePredictions.length) * 100
    : 0;

  const voteMap = new Map(baseRanking.map((entry) => [entry.digit, entry.weight]));
  const weightSum = baseNeighbors.reduce((sum, neighbor) => sum + neighbor.weight, 0);
  const weightSquares = baseNeighbors.reduce((sum, neighbor) => sum + neighbor.weight * neighbor.weight, 0);
  const weightedDistance = baseNeighbors.reduce((sum, neighbor) => sum + neighbor.distance * neighbor.weight, 0);
  const sameRegimeWeight = baseNeighbors
    .filter((neighbor) => neighbor.regime === liveState.regime)
    .reduce((sum, neighbor) => sum + neighbor.weight, 0);
  const dominantShare = weightSum > 0 ? (voteMap.get(patokan) ?? 0) / weightSum : 0;
  const effectiveNeighbors = weightSquares > 0 ? (weightSum * weightSum) / weightSquares : 0;
  const meanDistance = weightSum > 0 ? weightedDistance / weightSum : 1;
  const regimeAgreement = weightSum > 0 ? sameRegimeWeight / weightSum : 0;
  const confidence = Math.round((
    0.28 * Math.min(1, dominantShare / 0.45) +
    0.2 * Math.min(1, effectiveNeighbors / 8) +
    0.2 * Math.exp(-meanDistance) +
    0.22 * (ensembleStability / 100) +
    0.1 * regimeAgreement
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
      regimeAgreement: Number((regimeAgreement * 100).toFixed(1)),
      regime: liveState.regime,
    },
    neighbors: baseNeighbors,
  };
}

function targetArea(scanMode: ScanMode, target2D: Target2D, target3D: Target3D): Posisi[] {
  return is3DMode(scanMode) ? [...target3DPositions(target3D)] : [...target2DPositions(target2D)];
}

export function buildPairProfiles(
  scanMode: ScanMode,
  target2D: Target2D,
  target3D: Target3D,
): EchoProfile[] {
  if (
    scanMode === "posisi" ||
    scanMode === "off_posisi" ||
    isJumlah2DMode(scanMode) ||
    isShioMode(scanMode)
  ) return [];

  const area = targetArea(scanMode, target2D, target3D);
  if (area.length < 2) return [];
  const anchor = area[0];
  const areaCode = is3DMode(scanMode) ? `3${target3D[0].toUpperCase()}` : target2D[0].toUpperCase();
  return [
    { family: "EP", variant: "pairGap", formula: `EPG-${areaCode}`, anchorPos: anchor, sourceKind: "position", areaPositions: area },
    { family: "EP", variant: "pairSum", formula: `EPS-${areaCode}`, anchorPos: anchor, sourceKind: "position", areaPositions: area },
    { family: "EP", variant: "pairRelation", formula: `EPR-${areaCode}`, anchorPos: anchor, sourceKind: "position", areaPositions: area },
  ];
}

function targetColumnsForRow(deret: number[], targetDigits: number[], scanMode: ScanMode): Kolom[] {
  const columns = echoColumnsForMode(scanMode);
  return uniqueDigits(targetDigits)
    .map((digit) => columns[deret.indexOf(digit)])
    .filter((column): column is Kolom => Boolean(column));
}

export function buildPairBacktestRows(
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
    const prediction = predictPairAt(draws, targetIndex, profile, plan);
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
