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

type RawCycleNeighbor = {
  anchorIndex: number;
  anchorDraw: Draw;
  nextDraw: Draw;
  distance: number;
  movement: number;
  regime: EchoRegime;
};

const MAX_GAP = 24;

function modulusForMode(scanMode: ScanMode): number {
  return isShioMode(scanMode) ? 12 : 10;
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

function sourceValue(draws: Draw[], index: number, profile: EchoProfile, target2D: Target2D): number {
  if (profile.sourceKind === "jumlah2d") {
    const [left, right] = target2DPositions(target2D);
    return jumlah2dDigit(digitOf(draws[index], left), digitOf(draws[index], right));
  }
  if (profile.sourceKind === "shio") return targetShioIndexOf(draws[index], target2D);
  return digitOf(draws[index], profile.anchorPos ?? "K");
}

function occurrenceIndexes(
  draws: Draw[],
  index: number,
  value: number,
  profile: EchoProfile,
  target2D: Target2D,
  limit = 3,
): number[] {
  const indexes: number[] = [];
  for (let cursor = index - 1; cursor >= 0 && indexes.length < limit; cursor -= 1) {
    if (sourceValue(draws, cursor, profile, target2D) === value) indexes.push(cursor);
  }
  return indexes;
}

function currentGap(draws: Draw[], index: number, value: number, profile: EchoProfile, target2D: Target2D): number {
  const previous = occurrenceIndexes(draws, index, value, profile, target2D, 1)[0];
  return previous === undefined ? MAX_GAP : Math.min(MAX_GAP, index - previous);
}

function previousGap(draws: Draw[], index: number, value: number, profile: EchoProfile, target2D: Target2D): number {
  const indexes = occurrenceIndexes(draws, index, value, profile, target2D, 2);
  if (indexes.length < 2) return MAX_GAP;
  return Math.min(MAX_GAP, indexes[0] - indexes[1]);
}

function gapVector(
  draws: Draw[],
  index: number,
  profile: EchoProfile,
  target2D: Target2D,
  modulus: number,
): number[] {
  return Array.from({ length: modulus }, (_, value) => (
    currentGap(draws, index, value, profile, target2D) / MAX_GAP
  ));
}

function cycleDistance(
  draws: Draw[],
  anchor: number,
  liveAnchor: number,
  profile: EchoProfile,
  target2D: Target2D,
  modulus: number,
): number {
  const anchorValue = sourceValue(draws, anchor, profile, target2D);
  const liveValue = sourceValue(draws, liveAnchor, profile, target2D);
  const anchorCurrentGap = currentGap(draws, anchor, anchorValue, profile, target2D);
  const liveCurrentGap = currentGap(draws, liveAnchor, liveValue, profile, target2D);
  const anchorPreviousGap = previousGap(draws, anchor, anchorValue, profile, target2D);
  const livePreviousGap = previousGap(draws, liveAnchor, liveValue, profile, target2D);
  const gapDistance = Math.abs(anchorCurrentGap - liveCurrentGap) / MAX_GAP;
  const previousGapDistance = Math.abs(anchorPreviousGap - livePreviousGap) / MAX_GAP;
  const valueDistance = circularDistance(anchorValue, liveValue, modulus) / (modulus / 2);

  if (profile.variant === "cycleGap") {
    const anchorMove = circularDelta(anchorValue, sourceValue(draws, anchor - 1, profile, target2D), modulus);
    const liveMove = circularDelta(liveValue, sourceValue(draws, liveAnchor - 1, profile, target2D), modulus);
    const movementDistance = Math.min(1, Math.abs(anchorMove - liveMove) / (modulus / 2));
    return 0.5 * gapDistance + 0.25 * previousGapDistance + 0.15 * valueDistance + 0.1 * movementDistance;
  }

  const anchorVector = gapVector(draws, anchor, profile, target2D, modulus);
  const liveVector = gapVector(draws, liveAnchor, profile, target2D, modulus);
  const phaseDistance = mean(anchorVector.map((value, digit) => Math.abs(value - liveVector[digit])));
  const cycleRatioAnchor = anchorPreviousGap > 0 ? anchorCurrentGap / anchorPreviousGap : 1;
  const cycleRatioLive = livePreviousGap > 0 ? liveCurrentGap / livePreviousGap : 1;
  const ratioDistance = Math.min(1, Math.abs(cycleRatioAnchor - cycleRatioLive));
  return 0.58 * phaseDistance + 0.2 * gapDistance + 0.12 * ratioDistance + 0.1 * valueDistance;
}

function cycleRegime(currentGapValue: number, previousGapValue: number): EchoRegime {
  if (currentGapValue > previousGapValue + 2) return "EXPANDING";
  if (currentGapValue + 2 < previousGapValue) return "COMPRESSING";
  if (Math.abs(currentGapValue - previousGapValue) <= 1) return "REPEAT";
  return "MIXED";
}

function selectNeighbors(raw: RawCycleNeighbor[], plan: EchoEvaluationPlan, targetIndex: number): RawCycleNeighbor[] {
  const maximum = Math.min(plan.maximumNeighbors, ECHO_MAX_NEIGHBORS);
  const eraSize = targetIndex >= 150 ? 20 : 15;
  const sorted = [...raw].sort((left, right) => left.distance - right.distance || right.anchorIndex - left.anchorIndex);
  const selected: RawCycleNeighbor[] = [];
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
  const cutoff = Math.max(medianDistance * 2, medianDistance + 0.1);
  return selected
    .filter((neighbor, index) => index < ECHO_MIN_NEIGHBORS || neighbor.distance <= cutoff)
    .slice(0, maximum);
}

function weightedNeighbors(
  neighbors: RawCycleNeighbor[],
  liveAnchor: number,
  liveValue: number,
  modulus: number,
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
      projectedDigit: circularAdd(liveValue, neighbor.movement, modulus),
    };
  });
}

function voteRanking(neighbors: EchoNeighbor[], modulus: number, take = neighbors.length): Array<{ digit: number; weight: number }> {
  const votes = Array.from({ length: modulus }, () => 0);
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

export function predictCycleAt(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  scanMode: ScanMode,
  target2D: Target2D,
  plan: EchoEvaluationPlan,
): EchoPrediction | null {
  if (targetIndex < ECHO_MIN_HISTORY || targetIndex > draws.length) return null;
  const liveAnchor = targetIndex - 1;
  if (liveAnchor < 4) return null;

  const modulus = modulusForMode(scanMode);
  const liveValue = sourceValue(draws, liveAnchor, profile, target2D);
  const liveGap = currentGap(draws, liveAnchor, liveValue, profile, target2D);
  const livePreviousGap = previousGap(draws, liveAnchor, liveValue, profile, target2D);
  const raw: RawCycleNeighbor[] = [];

  for (let anchor = 4; anchor + 1 < targetIndex; anchor += 1) {
    const current = sourceValue(draws, anchor, profile, target2D);
    const next = sourceValue(draws, anchor + 1, profile, target2D);
    const movement = circularDelta(next, current, modulus);
    raw.push({
      anchorIndex: anchor,
      anchorDraw: draws[anchor],
      nextDraw: draws[anchor + 1],
      distance: cycleDistance(draws, anchor, liveAnchor, profile, target2D, modulus),
      movement,
      regime: cycleRegime(
        currentGap(draws, anchor, current, profile, target2D),
        previousGap(draws, anchor, current, profile, target2D),
      ),
    });
  }

  const nearest = selectNeighbors(raw, plan, targetIndex);
  if (nearest.length < ECHO_MIN_NEIGHBORS) return null;

  const medianDistance = nearest[Math.floor(nearest.length / 2)]?.distance ?? 0.5;
  const temperature = Math.max(0.14, Math.min(0.8, medianDistance * 1.3 + 0.1));
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
    .filter((neighbor) => neighbor.regime === cycleRegime(liveGap, livePreviousGap))
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
      regime: cycleRegime(liveGap, livePreviousGap),
    },
    neighbors: baseNeighbors,
  };
}

function areaForMode(scanMode: ScanMode, target2D: Target2D, target3D: Target3D): Posisi[] {
  if (is3DMode(scanMode)) return [...target3DPositions(target3D)];
  if (scanMode === "posisi" || scanMode === "off_posisi") return [];
  return [...target2DPositions(target2D)];
}

export function buildCycleProfiles(
  scanMode: ScanMode,
  targetPos: Posisi,
  target2D: Target2D,
  target3D: Target3D,
): EchoProfile[] {
  const profiles: EchoProfile[] = [];
  const area = areaForMode(scanMode, target2D, target3D);
  const add = (
    variant: "cycleGap" | "cyclePhase",
    formula: string,
    anchorPos: Posisi | null,
    sourceKind: EchoProfile["sourceKind"],
  ) => profiles.push({ family: "EC", variant, formula, anchorPos, sourceKind, areaPositions: area });

  if (isShioMode(scanMode)) {
    add("cycleGap", `ECG-S-${target2D[0].toUpperCase()}`, null, "shio");
    add("cyclePhase", `ECP-S-${target2D[0].toUpperCase()}`, null, "shio");
    return profiles;
  }

  if (isJumlah2DMode(scanMode)) {
    add("cycleGap", `ECG-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("cyclePhase", `ECP-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    return profiles;
  }

  const anchors = scanMode === "posisi" || scanMode === "off_posisi" ? [targetPos] : area;
  for (const anchor of anchors) {
    add("cycleGap", `ECG-${anchor}`, anchor, "position");
    add("cyclePhase", `ECP-${anchor}`, anchor, "position");
  }
  return profiles;
}

function targetColumnsForRow(deret: number[], targetDigits: number[], scanMode: ScanMode): Kolom[] {
  const columns = echoColumnsForMode(scanMode);
  return uniqueDigits(targetDigits)
    .map((digit) => columns[deret.indexOf(digit)])
    .filter((column): column is Kolom => Boolean(column));
}

export function buildCycleBacktestRows(
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
    const prediction = predictCycleAt(draws, targetIndex, profile, scanMode, target2D, plan);
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
