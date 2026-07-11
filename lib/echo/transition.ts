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
import type {
  EchoBacktestRow,
  EchoConfidenceLevel,
  EchoNeighbor,
  EchoProfile,
  EchoRegime,
} from "./types";
import type { EchoPrediction } from "./pattern";

const POSITIONS: Posisi[] = ["A", "C", "K", "E"];

type RawTransitionNeighbor = {
  anchorIndex: number;
  anchorDraw: Draw;
  nextDraw: Draw;
  distance: number;
  movement: number;
  regime: EchoRegime;
};

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

function transitionRegime(movement: number): EchoRegime {
  if (movement > 0) return "TREND_UP";
  if (movement < 0) return "TREND_DOWN";
  return "FLAT";
}

function normalizedPositionDistance(left: Draw, right: Draw): number {
  return mean(POSITIONS.map((position) => circularDistance(
    digitOf(left, position),
    digitOf(right, position),
    10,
  ) / 5));
}

function normalizedMovementDistance(
  draws: Draw[],
  leftIndex: number,
  rightIndex: number,
): number {
  if (leftIndex < 1 || rightIndex < 1) return 1;
  return mean(POSITIONS.map((position) => {
    const leftMovement = circularDelta(
      digitOf(draws[leftIndex], position),
      digitOf(draws[leftIndex - 1], position),
      10,
    );
    const rightMovement = circularDelta(
      digitOf(draws[rightIndex], position),
      digitOf(draws[rightIndex - 1], position),
      10,
    );
    return Math.min(1, Math.abs(leftMovement - rightMovement) / 5);
  }));
}

function transitionDistance(
  draws: Draw[],
  anchor: number,
  liveAnchor: number,
  profile: EchoProfile,
  target2D: Target2D,
  modulus: number,
): number {
  const currentDistance = circularDistance(
    sourceValue(draws, anchor, profile, target2D),
    sourceValue(draws, liveAnchor, profile, target2D),
    modulus,
  ) / (modulus / 2);

  if (profile.variant === "transition1") return currentDistance;

  const previousDistance = circularDistance(
    sourceValue(draws, anchor - 1, profile, target2D),
    sourceValue(draws, liveAnchor - 1, profile, target2D),
    modulus,
  ) / (modulus / 2);

  if (profile.variant === "transition2") {
    const anchorMove = circularDelta(
      sourceValue(draws, anchor, profile, target2D),
      sourceValue(draws, anchor - 1, profile, target2D),
      modulus,
    );
    const liveMove = circularDelta(
      sourceValue(draws, liveAnchor, profile, target2D),
      sourceValue(draws, liveAnchor - 1, profile, target2D),
      modulus,
    );
    const movementDistance = Math.min(1, Math.abs(anchorMove - liveMove) / (modulus / 2));
    return 0.5 * currentDistance + 0.3 * previousDistance + 0.2 * movementDistance;
  }

  const crossPositionDistance = normalizedPositionDistance(draws[anchor], draws[liveAnchor]);
  const crossMovementDistance = normalizedMovementDistance(draws, anchor, liveAnchor);
  return 0.35 * currentDistance + 0.15 * previousDistance + 0.3 * crossPositionDistance + 0.2 * crossMovementDistance;
}

function selectNeighbors(
  raw: RawTransitionNeighbor[],
  plan: EchoEvaluationPlan,
  targetIndex: number,
): RawTransitionNeighbor[] {
  const maximum = Math.min(plan.maximumNeighbors, ECHO_MAX_NEIGHBORS);
  const eraSize = targetIndex >= 150 ? 20 : 15;
  const sorted = [...raw].sort((left, right) => left.distance - right.distance || right.anchorIndex - left.anchorIndex);
  const selected: RawTransitionNeighbor[] = [];
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
  const cutoff = Math.max(medianDistance * 2, medianDistance + 0.12);
  return selected
    .filter((neighbor, index) => index < ECHO_MIN_NEIGHBORS || neighbor.distance <= cutoff)
    .slice(0, maximum);
}

function weightedNeighbors(
  neighbors: RawTransitionNeighbor[],
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

export function predictTransitionAt(
  draws: Draw[],
  targetIndex: number,
  profile: EchoProfile,
  scanMode: ScanMode,
  target2D: Target2D,
  plan: EchoEvaluationPlan,
): EchoPrediction | null {
  if (targetIndex < ECHO_MIN_HISTORY || targetIndex > draws.length) return null;
  const liveAnchor = targetIndex - 1;
  if (liveAnchor < 2) return null;

  const modulus = modulusForMode(scanMode);
  const liveValue = sourceValue(draws, liveAnchor, profile, target2D);
  const liveMovement = circularDelta(
    liveValue,
    sourceValue(draws, liveAnchor - 1, profile, target2D),
    modulus,
  );
  const raw: RawTransitionNeighbor[] = [];

  for (let anchor = 1; anchor + 1 < targetIndex; anchor += 1) {
    const current = sourceValue(draws, anchor, profile, target2D);
    const next = sourceValue(draws, anchor + 1, profile, target2D);
    const movement = circularDelta(next, current, modulus);
    raw.push({
      anchorIndex: anchor,
      anchorDraw: draws[anchor],
      nextDraw: draws[anchor + 1],
      distance: transitionDistance(draws, anchor, liveAnchor, profile, target2D, modulus),
      movement,
      regime: transitionRegime(movement),
    });
  }

  const nearest = selectNeighbors(raw, plan, targetIndex);
  if (nearest.length < ECHO_MIN_NEIGHBORS) return null;

  const medianDistance = nearest[Math.floor(nearest.length / 2)]?.distance ?? 0.5;
  const temperature = Math.max(0.16, Math.min(0.85, medianDistance * 1.25 + 0.12));
  const middleHalfLife = plan.halfLives[Math.floor(plan.halfLives.length / 2)];
  const baseNeighbors = weightedNeighbors(nearest, liveAnchor, liveValue, modulus, temperature, middleHalfLife);
  const baseRanking = voteRanking(baseNeighbors, modulus);
  const basePatokan = baseRanking[0]?.digit ?? circularAdd(liveValue, liveMovement, modulus);
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
  const exactWeight = baseNeighbors
    .filter((neighbor) => neighbor.distance <= 0.12)
    .reduce((sum, neighbor) => sum + neighbor.weight, 0);
  const matchingDirectionWeight = baseNeighbors
    .filter((neighbor) => Math.sign(neighbor.movement) === Math.sign(liveMovement))
    .reduce((sum, neighbor) => sum + neighbor.weight, 0);
  const dominantShare = weightSum > 0 ? (voteMap.get(patokan) ?? 0) / weightSum : 0;
  const effectiveNeighbors = weightSquares > 0 ? (weightSum * weightSum) / weightSquares : 0;
  const meanDistance = weightSum > 0 ? weightedDistance / weightSum : 1;
  const exactShare = weightSum > 0 ? exactWeight / weightSum : 0;
  const directionAgreement = weightSum > 0 ? matchingDirectionWeight / weightSum : 0;
  const confidence = Math.round((
    0.3 * Math.min(1, dominantShare / 0.45) +
    0.2 * Math.min(1, effectiveNeighbors / 8) +
    0.18 * Math.exp(-meanDistance) +
    0.2 * (ensembleStability / 100) +
    0.07 * exactShare +
    0.05 * directionAgreement
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
      regimeAgreement: Number((directionAgreement * 100).toFixed(1)),
      regime: transitionRegime(liveMovement),
    },
    neighbors: baseNeighbors,
  };
}

function areaForMode(scanMode: ScanMode, target2D: Target2D, target3D: Target3D): Posisi[] {
  if (is3DMode(scanMode)) return [...target3DPositions(target3D)];
  if (scanMode === "posisi" || scanMode === "off_posisi") return [];
  return [...target2DPositions(target2D)];
}

export function buildTransitionProfiles(
  scanMode: ScanMode,
  targetPos: Posisi,
  target2D: Target2D,
  target3D: Target3D,
): EchoProfile[] {
  const profiles: EchoProfile[] = [];
  const area = areaForMode(scanMode, target2D, target3D);
  const add = (
    variant: "transition1" | "transition2" | "transitionCross",
    formula: string,
    anchorPos: Posisi | null,
    sourceKind: EchoProfile["sourceKind"],
  ) => profiles.push({ family: "ET", variant, formula, anchorPos, sourceKind, areaPositions: area });

  if (isShioMode(scanMode)) {
    add("transition1", `ET1-S-${target2D[0].toUpperCase()}`, null, "shio");
    add("transition2", `ET2-S-${target2D[0].toUpperCase()}`, null, "shio");
    return profiles;
  }

  if (isJumlah2DMode(scanMode)) {
    add("transition1", `ET1-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("transition2", `ET2-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("transitionCross", `ETC-J-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    return profiles;
  }

  const anchors = scanMode === "posisi" || scanMode === "off_posisi" ? [targetPos] : area;
  for (const anchor of anchors) {
    add("transition1", `ET1-${anchor}`, anchor, "position");
    add("transition2", `ET2-${anchor}`, anchor, "position");
    add("transitionCross", `ETC-${anchor}`, anchor, "position");
  }
  return profiles;
}

function targetColumnsForRow(deret: number[], targetDigits: number[], scanMode: ScanMode): Kolom[] {
  const columns = echoColumnsForMode(scanMode);
  return uniqueDigits(targetDigits)
    .map((digit) => columns[deret.indexOf(digit)])
    .filter((column): column is Kolom => Boolean(column));
}

export function buildTransitionBacktestRows(
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
    const prediction = predictTransitionAt(draws, targetIndex, profile, scanMode, target2D, plan);
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
