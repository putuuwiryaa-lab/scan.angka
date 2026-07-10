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
  EchoVariant,
  EchoWindowAudit,
} from "./types";

const POSITIONS: Posisi[] = ["A", "C", "K", "E"];
const STATE_WINDOW = 3;
const MIN_HISTORY = 35;
const MIN_TOTAL_DATA = 70;
const MAX_NEIGHBORS = 12;
const MIN_NEIGHBORS = 7;
const RECENCY_HALF_LIFE = 60;
const RECENT_SIZE = 5;
const HOLDOUT_SIZE = 12;
const NEIGHBOR_STABILITY_COUNTS = [8, 10, 12] as const;
const DISCOVERY_WINDOWS = [
  { size: 12, weight: 0.4 },
  { size: 20, weight: 0.35 },
  { size: 30, weight: 0.25 },
] as const;
const MAX_BACKTEST = DISCOVERY_WINDOWS[DISCOVERY_WINDOWS.length - 1].size + HOLDOUT_SIZE;

interface EchoState {
  vector: number[];
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

function spreadOf(draw: Draw): number {
  const values = POSITIONS.map((pos) => digitOf(draw, pos));
  return Math.max(...values) - Math.min(...values);
}

function repeatCount(draw: Draw): number {
  const values = POSITIONS.map((pos) => digitOf(draw, pos));
  return values.length - new Set(values).size;
}

function recurrenceGap(index: number, value: number, getter: (drawIndex: number) => number): number {
  for (let cursor = index - 1; cursor >= Math.max(0, index - 12); cursor -= 1) {
    if (getter(cursor) === value) return index - cursor;
  }
  return 12;
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
  const current = valueAt(anchor);
  const previous = valueAt(anchor - 1);
  const before = valueAt(anchor - 2);
  const delta1 = circularDelta(current, previous, modulus);
  const delta2 = circularDelta(previous, before, modulus);
  const acceleration = circularDelta(delta1, delta2, modulus);
  const recurrence = recurrenceGap(anchor, current, valueAt) / 12;
  const regime = classifyRegime(draws, anchor);

  if (profile.variant === "local") {
    return {
      vector: [normalizedDelta(delta1, modulus), normalizedDelta(delta2, modulus), normalizedDelta(acceleration, modulus), recurrence],
      regime,
    };
  }

  const currentDraw = draws[anchor];
  const previousDraw = draws[anchor - 1];
  const beforeDraw = draws[anchor - 2];
  const movementNow = POSITIONS.map((pos) => normalizedDelta(circularDelta(digitOf(currentDraw, pos), digitOf(previousDraw, pos), 10), 10));
  const movementBefore = POSITIONS.map((pos) => normalizedDelta(circularDelta(digitOf(previousDraw, pos), digitOf(beforeDraw, pos), 10), 10));
  const spread = spreadOf(currentDraw) / 9;
  const spreadChange = (spreadOf(currentDraw) - spreadOf(previousDraw)) / 9;
  const repeats = repeatCount(currentDraw) / 3;

  if (profile.variant === "cross" || profile.variant === "regime") {
    return {
      vector: [...movementNow, ...movementBefore, normalizedDelta(acceleration, modulus), spread, spreadChange, repeats, recurrence],
      regime,
    };
  }

  const area = profile.areaPositions.length ? profile.areaPositions : POSITIONS;
  const areaNow = area.map((pos) => normalizedDelta(circularDelta(digitOf(currentDraw, pos), digitOf(previousDraw, pos), 10), 10));
  const areaBefore = area.map((pos) => normalizedDelta(circularDelta(digitOf(previousDraw, pos), digitOf(beforeDraw, pos), 10), 10));
  const left = area[0] ?? "K";
  const right = area[area.length - 1] ?? "E";
  const gapNow = circularDistance(digitOf(currentDraw, left), digitOf(currentDraw, right), 10) / 5;
  const gapBefore = circularDistance(digitOf(previousDraw, left), digitOf(previousDraw, right), 10) / 5;
  const sumNow = area.reduce((sum, pos) => sum + digitOf(currentDraw, pos), 0) % 10;
  const sumBefore = area.reduce((sum, pos) => sum + digitOf(previousDraw, pos), 0) % 10;

  return {
    vector: [...areaNow, ...areaBefore, gapNow, gapBefore, gapNow - gapBefore, normalizedDelta(circularDelta(sumNow, sumBefore, 10), 10), spread, repeats, recurrence],
    regime,
  };
}

function stateDistance(left: EchoState, right: EchoState, variant: EchoVariant): number {
  const length = Math.min(left.vector.length, right.vector.length);
  if (!length) return Number.POSITIVE_INFINITY;
  let squared = 0;
  for (let index = 0; index < length; index += 1) {
    const difference = left.vector[index] - right.vector[index];
    squared += difference * difference;
  }
  const base = Math.sqrt(squared / length);
  const regimePenalty = variant === "regime" && left.regime !== right.regime ? 0.42 : variant === "area" && left.regime !== right.regime ? 0.12 : 0;
  return base + regimePenalty;
}

function adaptiveNeighbors(raw: RawNeighbor[]): RawNeighbor[] {
  const sorted = [...raw].sort((left, right) => left.distance - right.distance || right.anchorIndex - left.anchorIndex);
  const selected: RawNeighbor[] = [];

  for (const candidate of sorted) {
    if (selected.some((item) => Math.abs(item.anchorIndex - candidate.anchorIndex) <= 1)) continue;
    selected.push(candidate);
    if (selected.length >= MAX_NEIGHBORS) break;
  }

  if (selected.length < MIN_NEIGHBORS) {
    for (const candidate of sorted) {
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
      if (selected.length >= MIN_NEIGHBORS) break;
    }
  }

  const core = selected.slice(0, MIN_NEIGHBORS);
  const coreMedian = core[Math.floor(core.length / 2)]?.distance ?? 1;
  const cutoff = Math.max(coreMedian * 1.85, coreMedian + 0.16);
  return selected.filter((item, index) => index < MIN_NEIGHBORS || item.distance <= cutoff).slice(0, MAX_NEIGHBORS);
}

function predictionFromNeighbors(neighbors: EchoNeighbor[], modulus: number, take: number): number {
  const votes = Array.from({ length: modulus }, () => 0);
  for (const neighbor of neighbors.slice(0, take)) votes[neighbor.projectedDigit] += neighbor.weight;
  return votes.map((weight, digit) => ({ digit, weight })).sort((left, right) => right.weight - left.weight || left.digit - right.digit)[0]?.digit ?? 0;
}

function confidenceLevel(confidence: number): EchoConfidenceLevel {
  if (confidence >= 75) return "HIGH";
  if (confidence >= 55) return "MEDIUM";
  return "LOW";
}

function predictAt(draws: Draw[], targetIndex: number, profile: EchoProfile, scanMode: ScanMode, target2D: Target2D): Prediction | null {
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

  const nearest = adaptiveNeighbors(raw);
  if (nearest.length < MIN_NEIGHBORS) return null;
  const medianDistance = nearest[Math.floor(nearest.length / 2)]?.distance ?? 0.5;
  const temperature = Math.max(0.35, Math.min(0.9, medianDistance * 1.45 + 0.18));

  const neighbors: EchoNeighbor[] = nearest.map((neighbor) => {
    const age = liveAnchor - neighbor.anchorIndex;
    const similarity = Math.exp(-neighbor.distance / temperature);
    const recency = Math.pow(0.5, age / RECENCY_HALF_LIFE);
    const weight = similarity * recency;
    return { ...neighbor, weight, projectedDigit: circularAdd(liveValue, neighbor.movement, modulus) };
  });

  const votes = Array.from({ length: modulus }, () => 0);
  let weightSum = 0;
  let weightSquares = 0;
  let weightedDistance = 0;
  for (const neighbor of neighbors) {
    votes[neighbor.projectedDigit] += neighbor.weight;
    weightSum += neighbor.weight;
    weightSquares += neighbor.weight * neighbor.weight;
    weightedDistance += neighbor.distance * neighbor.weight;
  }

  const rankedVotes = votes.map((weight, digit) => ({ digit, weight })).sort((left, right) => right.weight - left.weight || left.digit - right.digit);
  const patokan = rankedVotes[0]?.digit ?? liveValue;
  const dominantShare = weightSum > 0 ? (rankedVotes[0]?.weight ?? 0) / weightSum : 0;
  const effectiveNeighbors = weightSquares > 0 ? (weightSum * weightSum) / weightSquares : 0;
  const meanDistance = weightSum > 0 ? weightedDistance / weightSum : 1;
  const stabilityPredictions = NEIGHBOR_STABILITY_COUNTS.map((count) => predictionFromNeighbors(neighbors, modulus, Math.min(count, neighbors.length)));
  const stability = (stabilityPredictions.filter((digit) => digit === patokan).length / NEIGHBOR_STABILITY_COUNTS.length) * 100;
  const voteScore = Math.min(1, dominantShare / 0.5);
  const neighborScore = Math.min(1, effectiveNeighbors / 8);
  const similarityScore = Math.exp(-meanDistance);
  const confidence = Math.round((0.35 * voteScore + 0.25 * neighborScore + 0.2 * similarityScore + 0.2 * (stability / 100)) * 100);

  return {
    patokan,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    quality: {
      neighborCount: neighbors.length,
      effectiveNeighbors: Number(effectiveNeighbors.toFixed(2)),
      meanDistance: Number(meanDistance.toFixed(3)),
      dominantShare: Number((dominantShare * 100).toFixed(1)),
      stability: Number(stability.toFixed(1)),
      regime: liveState.regime,
    },
    neighbors,
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

function discoveryAudit(statuses: boolean[]) {
  const windows: EchoWindowAudit[] = DISCOVERY_WINDOWS.map(({ size, weight }) => {
    const sample = statuses.slice(-Math.min(size, statuses.length));
    const hit = sample.filter(Boolean).length;
    return {
      window: size,
      weight,
      hit,
      total: sample.length,
      rate: sample.length ? Number(((hit / sample.length) * 100).toFixed(1)) : 0,
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

function weakestRate(windows: EchoWindowAudit[]): number {
  return windows.reduce((minimum, window) => Math.min(minimum, window.rate), 100);
}

function selectColumns(rows: EchoBacktestRow[], digitCount: number, scanMode: ScanMode): ColumnSelection | null {
  const available = columnsForMode(scanMode);
  if (digitCount < 1 || digitCount > available.length || rows.length <= HOLDOUT_SIZE) return null;
  const discoveryRows = rows.slice(0, -HOLDOUT_SIZE);
  const holdoutRows = rows.slice(-HOLDOUT_SIZE);
  let best: ColumnSelection | null = null;

  for (const columns of combinations(available, digitCount)) {
    const selected = new Set<Kolom>(columns);
    const discoveryStatuses = discoveryRows.map((row) => rowCovered(row.targetColumns, selected, scanMode));
    const holdoutStatuses = holdoutRows.map((row) => rowCovered(row.targetColumns, selected, scanMode));
    const auditWindows = discoveryAudit(discoveryStatuses);
    const holdoutHit = holdoutStatuses.filter(Boolean).length;
    const recentStatuses = holdoutStatuses.slice(-RECENT_SIZE);
    const allStatuses = [...discoveryStatuses, ...holdoutStatuses];
    const columnUsage = discoveryRows.reduce((sum, row) => sum + row.targetColumns.filter((column) => selected.has(column)).length, 0);
    const efficiency = columnUsage / Math.max(1, discoveryRows.length * columns.length);
    const audit: EchoAudit = {
      discoveryHit: discoveryStatuses.filter(Boolean).length,
      discoveryTotal: discoveryStatuses.length,
      discoveryWeightedAccuracy: auditWindows.weightedAccuracy,
      discoveryWindowStability: auditWindows.stability,
      strongestWindow: auditWindows.strongestWindow,
      weakestWindow: auditWindows.weakestWindow,
      windows: auditWindows.windows,
      holdoutHit,
      holdoutTotal: holdoutStatuses.length,
      holdoutRate: holdoutStatuses.length ? Number(((holdoutHit / holdoutStatuses.length) * 100).toFixed(1)) : 0,
      recentHit: recentStatuses.filter(Boolean).length,
      recentTotal: recentStatuses.length,
      longestMissStreak: longestMissStreak(allStatuses),
    };
    const selectedRows = rows.map((row, index) => ({ ...row, covered: allStatuses[index] }));
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

function backtestRows(draws: Draw[], profile: EchoProfile, scanMode: ScanMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D): EchoBacktestRow[] {
  const start = Math.max(MIN_HISTORY, draws.length - MAX_BACKTEST);
  const rows: EchoBacktestRow[] = [];
  for (let targetIndex = start; targetIndex < draws.length; targetIndex += 1) {
    const prediction = predictAt(draws, targetIndex, profile, scanMode, target2D);
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
  return rows;
}

function baseScore(selection: ColumnSelection, confidence: number, quality: EchoQuality): number {
  const discovery = selection.audit.discoveryWeightedAccuracy / 100;
  const holdout = selection.audit.holdoutRate / 100;
  const recent = selection.audit.recentTotal ? selection.audit.recentHit / selection.audit.recentTotal : 0;
  const stability = ((quality.stability * 0.55) + (selection.audit.discoveryWindowStability * 0.45)) / 100;
  let score = (0.28 * discovery + 0.3 * holdout + 0.14 * recent + 0.16 * (confidence / 100) + 0.12 * stability) * 100;
  if (quality.effectiveNeighbors < MIN_NEIGHBORS) score -= 15;
  if (confidence < 55) score -= 8;
  if (selection.audit.holdoutRate + 25 < selection.audit.discoveryWeightedAccuracy) score -= 10;
  if (selection.audit.longestMissStreak > 3) score -= 7;
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

export function runEcho(draws: Draw[], config: EchoConfig): EchoResult {
  if (draws.length < MIN_TOTAL_DATA) throw new Error(`Data belum cukup. Echo Engine membutuhkan minimal ${MIN_TOTAL_DATA} result.`);

  const scanMode = scanModeOrDefault(config.scanMode);
  const targetPos = config.targetPos ?? "K";
  const target2D = target2DOrDefault(config.target2D);
  const target3D = target3DOrDefault(config.target3D);
  const digitCount = clamp(config.digitCount, 4, 1, isShioMode(scanMode) ? 12 : 9);
  const profiles = buildProfiles(scanMode, targetPos, target2D, target3D);
  const candidates: EchoItem[] = [];

  for (const profile of profiles) {
    const rows = backtestRows(draws, profile, scanMode, targetPos, target2D, target3D);
    const selection = selectColumns(rows, digitCount, scanMode);
    const live = predictAt(draws, draws.length, profile, scanMode, target2D);
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
    right.audit.holdoutRate - left.audit.holdoutRate ||
    right.familyAgreement - left.familyAgreement ||
    right.confidence - left.confidence ||
    left.formula.localeCompare(right.formula)
  );

  return {
    config: {
      targetPos,
      target2D,
      target3D,
      digitCount,
      scanMode,
      discoveryWindows: DISCOVERY_WINDOWS.map((window) => window.size),
      holdoutSize: HOLDOUT_SIZE,
    },
    totalProfiles: profiles.length,
    totalQualified: ranked.length,
    items: ranked.slice(0, 1),
  };
}

export const ECHO_INTERNAL_CONFIG = {
  stateWindow: STATE_WINDOW,
  minHistory: MIN_HISTORY,
  minimumTotalData: MIN_TOTAL_DATA,
  maximumNeighbors: MAX_NEIGHBORS,
  minimumNeighbors: MIN_NEIGHBORS,
  recencyHalfLife: RECENCY_HALF_LIFE,
  neighborStabilityCounts: [...NEIGHBOR_STABILITY_COUNTS],
  discoveryWindows: DISCOVERY_WINDOWS.map((window) => ({ ...window })),
  holdoutSize: HOLDOUT_SIZE,
};
