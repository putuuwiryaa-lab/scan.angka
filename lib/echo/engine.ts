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
  EchoItem,
  EchoNeighbor,
  EchoProfile,
  EchoQuality,
  EchoRegime,
  EchoResult,
  EchoVariant,
} from "./types";

const POSITIONS: Posisi[] = ["A", "C", "K", "E"];
const STATE_WINDOW = 3;
const MIN_HISTORY = 35;
const NEIGHBOR_COUNT = 12;
const MIN_NEIGHBORS = 7;
const RECENCY_HALF_LIFE = 60;
const RECENT_AUDIT_SIZE = 5;
const STABILITY_COUNTS = [8, 10, 12] as const;
const TEMPERATURE = 0.72;

interface EchoState {
  vector: number[];
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

function recurrenceGap(draws: Draw[], index: number, value: number, getter: (drawIndex: number) => number): number {
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
  const deltas = POSITIONS.map((pos) => circularDelta(digitOf(latest, pos), digitOf(previous, pos), 10));
  const prior = POSITIONS.map((pos) => circularDelta(digitOf(previous, pos), digitOf(before, pos), 10));
  const positives = deltas.filter((value) => value > 0).length;
  const negatives = deltas.filter((value) => value < 0).length;
  const flat = deltas.filter((value) => Math.abs(value) <= 1).length;
  const reversals = deltas.filter((value, index) => value !== 0 && prior[index] !== 0 && Math.sign(value) !== Math.sign(prior[index])).length;
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
  const recurrence = recurrenceGap(draws, anchor, current, valueAt) / 12;
  const regime = classifyRegime(draws, anchor);

  if (profile.variant === "local") {
    return {
      vector: [
        normalizedDelta(delta1, modulus),
        normalizedDelta(delta2, modulus),
        normalizedDelta(acceleration, modulus),
        recurrence,
      ],
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
      vector: [
        ...movementNow,
        ...movementBefore,
        normalizedDelta(acceleration, modulus),
        spread,
        spreadChange,
        repeats,
        recurrence,
      ],
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
    vector: [
      ...areaNow,
      ...areaBefore,
      gapNow,
      gapBefore,
      gapNow - gapBefore,
      normalizedDelta(circularDelta(sumNow, sumBefore, 10), 10),
      spread,
      repeats,
      recurrence,
    ],
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

function predictionFromNeighbors(neighbors: EchoNeighbor[], modulus: number, take: number): number {
  const votes = Array.from({ length: modulus }, () => 0);
  for (const neighbor of neighbors.slice(0, take)) votes[neighbor.projectedDigit] += neighbor.weight;
  return votes.map((weight, digit) => ({ digit, weight })).sort((a, b) => b.weight - a.weight || a.digit - b.digit)[0]?.digit ?? 0;
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
  const raw: Array<Omit<EchoNeighbor, "weight" | "projectedDigit">> = [];

  for (let anchor = STATE_WINDOW - 1; anchor + 1 < targetIndex; anchor += 1) {
    const state = buildState(draws, anchor, profile, target2D);
    const distance = stateDistance(liveState, state, profile.variant);
    const current = sourceValue(draws, anchor, profile, target2D);
    const next = sourceValue(draws, anchor + 1, profile, target2D);
    raw.push({
      anchorIndex: anchor,
      anchorDraw: draws[anchor],
      nextDraw: draws[anchor + 1],
      distance,
      movement: circularDelta(next, current, modulus),
      regime: state.regime,
    });
  }

  const nearest = raw.sort((a, b) => a.distance - b.distance || b.anchorIndex - a.anchorIndex).slice(0, NEIGHBOR_COUNT);
  if (nearest.length < MIN_NEIGHBORS) return null;

  const neighbors: EchoNeighbor[] = nearest.map((neighbor) => {
    const age = liveAnchor - neighbor.anchorIndex;
    const similarity = Math.exp(-neighbor.distance / TEMPERATURE);
    const recency = Math.pow(0.5, age / RECENCY_HALF_LIFE);
    const weight = similarity * recency;
    return {
      ...neighbor,
      weight,
      projectedDigit: circularAdd(liveValue, neighbor.movement, modulus),
    };
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

  const rankedVotes = votes.map((weight, digit) => ({ digit, weight })).sort((a, b) => b.weight - a.weight || a.digit - b.digit);
  const patokan = rankedVotes[0]?.digit ?? liveValue;
  const dominantShare = weightSum > 0 ? (rankedVotes[0]?.weight ?? 0) / weightSum : 0;
  const effectiveNeighbors = weightSquares > 0 ? (weightSum * weightSum) / weightSquares : 0;
  const meanDistance = weightSum > 0 ? weightedDistance / weightSum : 1;
  const stabilityPredictions = STABILITY_COUNTS.map((count) => predictionFromNeighbors(neighbors, modulus, count));
  const stabilityMatches = stabilityPredictions.filter((digit) => digit === patokan).length;
  const stability = (stabilityMatches / STABILITY_COUNTS.length) * 100;

  const voteScore = Math.min(1, dominantShare / 0.5);
  const neighborScore = Math.min(1, effectiveNeighbors / 8);
  const similarityScore = Math.exp(-meanDistance);
  const stabilityScore = stability / 100;
  const confidence = Math.round((0.35 * voteScore + 0.25 * neighborScore + 0.2 * similarityScore + 0.2 * stabilityScore) * 100);

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
  const covered = targetColumns.filter((column) => selected.has(column)).length;
  return covered >= requiredCover(scanMode, targetColumns);
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

function longestMissStreak(covered: boolean[]): number {
  let longest = 0;
  let current = 0;
  for (const hit of covered) {
    if (hit) current = 0;
    else {
      current += 1;
      longest = Math.max(longest, current);
    }
  }
  return longest;
}

function selectColumns(rows: EchoBacktestRow[], digitCount: number, scanMode: ScanMode): ColumnSelection | null {
  const available = columnsForMode(scanMode);
  if (digitCount < 1 || digitCount > available.length || !rows.length) return null;

  let best: ColumnSelection | null = null;
  for (const columns of combinations(available, digitCount)) {
    const selected = new Set<Kolom>(columns);
    const statuses = rows.map((row) => rowCovered(row.targetColumns, selected, scanMode));
    const hit = statuses.filter(Boolean).length;
    const recentStatuses = statuses.slice(-RECENT_AUDIT_SIZE);
    const recentHit = recentStatuses.filter(Boolean).length;
    const streak = longestMissStreak(statuses);
    const columnUsage = rows.reduce((sum, row) => sum + row.targetColumns.filter((column) => selected.has(column)).length, 0);
    const efficiency = columnUsage / Math.max(1, rows.length * columns.length);
    const selectedRows = rows.map((row, index) => ({ ...row, covered: statuses[index] }));
    const audit: EchoAudit = {
      hit,
      total: rows.length,
      recentHit,
      recentTotal: recentStatuses.length,
      longestMissStreak: streak,
    };
    const candidate: ColumnSelection = { columns: [...columns], audit, rows: selectedRows, efficiency };

    if (!best ||
      candidate.audit.hit > best.audit.hit ||
      (candidate.audit.hit === best.audit.hit && candidate.audit.recentHit > best.audit.recentHit) ||
      (candidate.audit.hit === best.audit.hit && candidate.audit.recentHit === best.audit.recentHit && candidate.audit.longestMissStreak < best.audit.longestMissStreak) ||
      (candidate.audit.hit === best.audit.hit && candidate.audit.recentHit === best.audit.recentHit && candidate.audit.longestMissStreak === best.audit.longestMissStreak && candidate.efficiency > best.efficiency) ||
      (candidate.audit.hit === best.audit.hit && candidate.audit.recentHit === best.audit.recentHit && candidate.audit.longestMissStreak === best.audit.longestMissStreak && candidate.efficiency === best.efficiency && columns.join("") < best.columns.join(""))) {
      best = candidate;
    }
  }
  return best;
}

function buildProfiles(scanMode: ScanMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D): EchoProfile[] {
  const profiles: EchoProfile[] = [];
  const area = areaForMode(scanMode, target2D, target3D);
  const add = (family: EchoProfile["family"], variant: EchoVariant, formula: string, anchorPos: Posisi | null, sourceKind: EchoProfile["sourceKind"], areaPositions: Posisi[]) => {
    profiles.push({ family, variant, formula, anchorPos, sourceKind, areaPositions });
  };

  if (isShioMode(scanMode)) {
    add("ES", "local", `ES-L-${target2D[0].toUpperCase()}`, null, "shio", area);
    add("ES", "cross", `ES-X-${target2D[0].toUpperCase()}`, null, "shio", area);
    add("ES", "regime", `ES-R-${target2D[0].toUpperCase()}`, null, "shio", area);
    return profiles;
  }

  if (isJumlah2DMode(scanMode)) {
    add("EJ", "local", `EJ-L-${target2D[0].toUpperCase()}`, null, "jumlah2d", area);
    add("EJ", "cross", `EJ-X-${target2D[0].toUpperCase()}`, null, "jumlah2d", area);
    add("EJ", "regime", `EJ-R-${target2D[0].toUpperCase()}`, null, "jumlah2d", area);
    add("EJ", "area", `EJ-A-${target2D[0].toUpperCase()}`, null, "jumlah2d", area);
    return profiles;
  }

  const anchors = scanMode === "posisi" || scanMode === "off_posisi" ? [targetPos] : area;
  const areaCode = is3DMode(scanMode) ? `3${target3D[0].toUpperCase()}` : target2D[0].toUpperCase();
  for (const anchor of anchors) {
    add("EL", "local", `EL-${anchor}`, anchor, "position", area);
    add("EX", "cross", `EX-${anchor}`, anchor, "position", area);
    add("ER", "regime", `ER-${anchor}`, anchor, "position", area);
    if (area.length) add("EA", "area", `EA-${areaCode}-${anchor}`, anchor, "position", area);
  }
  return profiles;
}

function backtestRows(draws: Draw[], profile: EchoProfile, L: number, scanMode: ScanMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D): EchoBacktestRow[] {
  const start = Math.max(MIN_HISTORY, draws.length - L);
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

function scoreItem(selection: ColumnSelection, confidence: number, quality: EchoQuality): number {
  const history = selection.audit.total ? selection.audit.hit / selection.audit.total : 0;
  const recent = selection.audit.recentTotal ? selection.audit.recentHit / selection.audit.recentTotal : 0;
  const stability = quality.stability / 100;
  const confidenceScore = confidence / 100;
  const efficiency = Math.min(1, selection.efficiency);
  let score = (0.4 * history + 0.2 * recent + 0.2 * confidenceScore + 0.1 * stability + 0.1 * efficiency) * 100;
  if (confidence < 55) score -= 10;
  if (quality.effectiveNeighbors < 7) score -= 15;
  if (selection.audit.longestMissStreak > 2) score -= 8;
  return Number(Math.max(0, score).toFixed(2));
}

function overlapRatio(left: number[], right: number[]): number {
  const leftSet = new Set(left);
  const common = uniqueDigits(right).filter((digit) => leftSet.has(digit)).length;
  return common / Math.max(1, Math.min(uniqueDigits(left).length, uniqueDigits(right).length));
}

function selectDiverse(items: EchoItem[], limit: number): EchoItem[] {
  const remaining = [...items].sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.formula.localeCompare(b.formula));
  const selected: EchoItem[] = [];
  while (selected.length < limit && remaining.length) {
    let bestIndex = 0;
    let bestAdjusted = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const familyPenalty = selected.some((chosen) => chosen.family === item.family) ? 4 : 0;
      const overlapPenalty = selected.reduce((max, chosen) => Math.max(max, overlapRatio(chosen.angkaHidup, item.angkaHidup)), 0) >= 0.8 ? 6 : 0;
      const adjusted = item.score - familyPenalty - overlapPenalty;
      if (adjusted > bestAdjusted || (adjusted === bestAdjusted && item.formula < remaining[bestIndex].formula)) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected;
}

export function runEcho(draws: Draw[], config: EchoConfig): EchoResult {
  if (draws.length < MIN_HISTORY + 5) throw new Error(`Data belum cukup. Echo Engine membutuhkan minimal ${MIN_HISTORY + 5} result.`);

  const scanMode = scanModeOrDefault(config.scanMode);
  const targetPos = config.targetPos ?? "K";
  const target2D = target2DOrDefault(config.target2D);
  const target3D = target3DOrDefault(config.target3D);
  const L = clamp(config.L, 14, 1, 100);
  const maxDigits = isShioMode(scanMode) ? 12 : 9;
  const digitCount = clamp(config.digitCount, 4, 1, maxDigits);
  const stopScan = clamp(config.stopScan, 3, 1, 50);
  const profiles = buildProfiles(scanMode, targetPos, target2D, target3D);
  const items: EchoItem[] = [];

  for (const profile of profiles) {
    const rows = backtestRows(draws, profile, L, scanMode, targetPos, target2D, target3D);
    if (!rows.length) continue;
    const selection = selectColumns(rows, digitCount, scanMode);
    const live = predictAt(draws, draws.length, profile, scanMode, target2D);
    if (!selection || !live) continue;

    const deretLive = deretForMode(live.patokan, scanMode);
    const sourceColumns = columnsForMode(scanMode);
    const selectedSet = new Set(selection.columns);
    const angkaHidup = selection.columns.map((column) => deretLive[sourceColumns.indexOf(column)]).filter((digit): digit is number => Number.isFinite(digit));
    const kolomMati = sourceColumns.filter((column) => !selectedSet.has(column));
    const angkaMati = kolomMati.map((column) => deretLive[sourceColumns.indexOf(column)]).filter((digit): digit is number => Number.isFinite(digit));

    items.push({
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
      score: scoreItem(selection, live.confidence, live.quality),
      confidence: live.confidence,
      confidenceLevel: live.confidenceLevel,
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
  for (const item of items) {
    const signature = `${item.scanMode}:${item.targetPos}:${item.target2D}:${item.target3D}:${[...item.angkaHidup].sort((a, b) => a - b).join("")}`;
    const previous = deduped.get(signature);
    if (!previous || item.score > previous.score) deduped.set(signature, item);
  }

  const qualified = [...deduped.values()];
  return {
    config: { L, targetPos, target2D, target3D, digitCount, stopScan, scanMode },
    totalProfiles: profiles.length,
    totalQualified: qualified.length,
    items: selectDiverse(qualified, stopScan),
  };
}

export const ECHO_INTERNAL_CONFIG = {
  stateWindow: STATE_WINDOW,
  minHistory: MIN_HISTORY,
  neighborCount: NEIGHBOR_COUNT,
  minimumNeighbors: MIN_NEIGHBORS,
  recencyHalfLife: RECENCY_HALF_LIFE,
  stabilityNeighborCounts: [...STABILITY_COUNTS],
};
