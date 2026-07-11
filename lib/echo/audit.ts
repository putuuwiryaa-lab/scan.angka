import {
  buildDeret,
  buildDeretShio,
  isOffMode,
  isShioMode,
  targetDigitsOf,
  uniqueDigits,
} from "../engine/helpers";
import {
  KOLOM,
  SHIO_KOLOM,
  type Draw,
  type Kolom,
  type Posisi,
  type ScanMode,
  type Target2D,
  type Target3D,
} from "../engine/types";
import {
  ECHO_MIN_HISTORY,
  ECHO_RECENT_SIZE,
  type EchoEvaluationPlan,
  type EchoWindowSpec,
} from "./config";
import { predictEchoAt } from "./pattern";
import type { EchoAudit, EchoBacktestRow, EchoProfile, EchoWindowAudit } from "./types";

export interface EchoColumnFit {
  columns: Kolom[];
  statuses: boolean[];
  rows: EchoBacktestRow[];
  hit: number;
  total: number;
  rate: number;
  weightedAccuracy: number;
  baselineRate: number;
  lift: number;
  windowStability: number;
  strongestWindow: number;
  weakestWindow: number;
  windows: EchoWindowAudit[];
  longestMissStreak: number;
  efficiency: number;
}

export interface EchoPhaseAudit {
  statuses: boolean[];
  rows: EchoBacktestRow[];
  hit: number;
  total: number;
  rate: number;
  baselineRate: number;
  lift: number;
  longestMissStreak: number;
}

export interface EchoRowSplit {
  discovery: EchoBacktestRow[];
  validation: EchoBacktestRow[];
  holdout: EchoBacktestRow[];
}

export function echoColumnsForMode(scanMode: ScanMode): readonly Kolom[] {
  return isShioMode(scanMode) ? SHIO_KOLOM : KOLOM;
}

export function echoDeretForMode(patokan: number, scanMode: ScanMode): number[] {
  return isShioMode(scanMode) ? buildDeretShio(patokan) : buildDeret(patokan);
}

function targetColumnsForRow(deret: number[], targetDigits: number[], scanMode: ScanMode): Kolom[] {
  const columns = echoColumnsForMode(scanMode);
  return uniqueDigits(targetDigits)
    .map((digit) => columns[deret.indexOf(digit)])
    .filter((column): column is Kolom => Boolean(column));
}

function requiredCoverCount(scanMode: ScanMode, targetCount: number): number {
  if (scanMode === "ai_2d_belakang") return Math.min(1, targetCount);
  if (scanMode === "ai_3d") return Math.min(2, targetCount);
  return targetCount;
}

function requiredCover(scanMode: ScanMode, targetColumns: Kolom[]): number {
  return requiredCoverCount(scanMode, targetColumns.length);
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
  for (let index = 1; index <= safeK; index += 1) {
    result = (result * (n - safeK + index)) / index;
  }
  return result;
}

function randomCoverageProbability(
  total: number,
  selected: number,
  targets: number,
  required: number,
  offMode: boolean,
): number {
  const denominator = combination(total, selected);
  if (!denominator || targets <= 0) return 0;
  if (offMode) return combination(total - targets, selected) / denominator;

  let probability = 0;
  for (let hits = required; hits <= Math.min(targets, selected); hits += 1) {
    probability += combination(targets, hits) *
      combination(total - targets, selected - hits) /
      denominator;
  }
  return probability;
}

function targetArity(scanMode: ScanMode): number {
  if (scanMode === "ai_3d" || scanMode === "bbfs_3d" || scanMode === "off_3d") return 3;
  if (
    scanMode === "ai_2d_belakang" ||
    scanMode === "bbfs_2d_belakang" ||
    scanMode === "off_2d_belakang"
  ) return 2;
  return 1;
}

export function theoreticalBaselineRate(digitCount: number, scanMode: ScanMode): number {
  const totalColumns = echoColumnsForMode(scanMode).length;
  if (digitCount < 1 || digitCount > totalColumns) return 0;

  const arity = targetArity(scanMode);
  const outcome: number[] = [];
  let probabilityTotal = 0;
  let outcomeCount = 0;

  function walk(depth: number) {
    if (depth === arity) {
      const uniqueTargets = new Set(outcome).size;
      probabilityTotal += randomCoverageProbability(
        totalColumns,
        digitCount,
        uniqueTargets,
        requiredCoverCount(scanMode, uniqueTargets),
        isOffMode(scanMode),
      );
      outcomeCount += 1;
      return;
    }

    for (let value = 0; value < totalColumns; value += 1) {
      outcome.push(value);
      walk(depth + 1);
      outcome.pop();
    }
  }

  walk(0);
  return outcomeCount
    ? Number(((probabilityTotal / outcomeCount) * 100).toFixed(1))
    : 0;
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
  return statuses.length
    ? Number(((statuses.filter(Boolean).length / statuses.length) * 100).toFixed(1))
    : 0;
}

function discoveryWindows(statuses: boolean[], specs: EchoWindowSpec[]): {
  windows: EchoWindowAudit[];
  weightedAccuracy: number;
  stability: number;
  strongestWindow: number;
  weakestWindow: number;
} {
  const windows = specs.map(({ size, weight }) => {
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

  const weightTotal = windows.reduce((sum, window) => sum + window.weight, 0);
  const weightedAccuracy = weightTotal
    ? windows.reduce((sum, window) => sum + window.rate * window.weight, 0) / weightTotal
    : 0;
  const rates = windows.map((window) => window.rate);
  const stability = rates.length
    ? Math.max(0, 100 - (Math.max(...rates) - Math.min(...rates)))
    : 0;
  const strongest = [...windows].sort(
    (left, right) => right.rate - left.rate || left.window - right.window,
  )[0];
  const weakest = [...windows].sort(
    (left, right) => left.rate - right.rate || right.window - left.window,
  )[0];

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

function markRows(
  rows: EchoBacktestRow[],
  statuses: boolean[],
  phase: EchoBacktestRow["phase"],
): EchoBacktestRow[] {
  return rows.map((row, index) => ({ ...row, covered: statuses[index] ?? false, phase }));
}

export function splitEchoRows(rows: EchoBacktestRow[], plan: EchoEvaluationPlan): EchoRowSplit {
  return {
    discovery: rows.slice(0, plan.discoverySize),
    validation: rows.slice(plan.discoverySize, plan.discoverySize + plan.validationSize),
    holdout: rows.slice(plan.discoverySize + plan.validationSize, plan.totalRows),
  };
}

function isBetterFit(candidate: EchoColumnFit, best: EchoColumnFit): boolean {
  if (candidate.weightedAccuracy !== best.weightedAccuracy) {
    return candidate.weightedAccuracy > best.weightedAccuracy;
  }
  if (candidate.lift !== best.lift) return candidate.lift > best.lift;

  const candidateWeakest = weakestRate(candidate.windows);
  const bestWeakest = weakestRate(best.windows);
  if (candidateWeakest !== bestWeakest) return candidateWeakest > bestWeakest;
  if (candidate.windowStability !== best.windowStability) {
    return candidate.windowStability > best.windowStability;
  }
  if (candidate.longestMissStreak !== best.longestMissStreak) {
    return candidate.longestMissStreak < best.longestMissStreak;
  }
  if (candidate.efficiency !== best.efficiency) return candidate.efficiency > best.efficiency;
  return candidate.columns.join("") < best.columns.join("");
}

export function fitEchoColumns(
  trainingRows: EchoBacktestRow[],
  digitCount: number,
  scanMode: ScanMode,
  specs: EchoWindowSpec[],
): EchoColumnFit | null {
  const available = echoColumnsForMode(scanMode);
  if (!trainingRows.length || digitCount < 1 || digitCount > available.length) return null;

  const baseline = theoreticalBaselineRate(digitCount, scanMode);
  let best: EchoColumnFit | null = null;

  for (const columns of combinations(available, digitCount)) {
    const selected = new Set<Kolom>(columns);
    const statuses = trainingRows.map((row) => rowCovered(row.targetColumns, selected, scanMode));
    const windows = discoveryWindows(statuses, specs);
    const columnUsage = trainingRows.reduce(
      (sum, row) => sum + row.targetColumns.filter((column) => selected.has(column)).length,
      0,
    );
    const efficiency = isOffMode(scanMode)
      ? 1 - columnUsage / Math.max(1, trainingRows.length * columns.length)
      : columnUsage / Math.max(1, trainingRows.length * columns.length);

    const candidate: EchoColumnFit = {
      columns: [...columns],
      statuses,
      rows: markRows(trainingRows, statuses, "discovery"),
      hit: statuses.filter(Boolean).length,
      total: statuses.length,
      rate: rateOf(statuses),
      weightedAccuracy: windows.weightedAccuracy,
      baselineRate: baseline,
      lift: Number((windows.weightedAccuracy - baseline).toFixed(1)),
      windowStability: windows.stability,
      strongestWindow: windows.strongestWindow,
      weakestWindow: windows.weakestWindow,
      windows: windows.windows,
      longestMissStreak: longestMissStreak(statuses),
      efficiency,
    };

    if (!best || isBetterFit(candidate, best)) best = candidate;
  }

  return best;
}

export function evaluateFrozenRows(
  rows: EchoBacktestRow[],
  columns: Kolom[],
  digitCount: number,
  scanMode: ScanMode,
  phase: EchoBacktestRow["phase"],
): EchoPhaseAudit {
  const selected = new Set<Kolom>(columns);
  const statuses = rows.map((row) => rowCovered(row.targetColumns, selected, scanMode));
  const rate = rateOf(statuses);
  const baseline = theoreticalBaselineRate(digitCount, scanMode);

  return {
    statuses,
    rows: markRows(rows, statuses, phase),
    hit: statuses.filter(Boolean).length,
    total: statuses.length,
    rate,
    baselineRate: baseline,
    lift: Number((rate - baseline).toFixed(1)),
    longestMissStreak: longestMissStreak(statuses),
  };
}

export function evaluateNestedWalkForward(
  seedRows: EchoBacktestRow[],
  validationRows: EchoBacktestRow[],
  digitCount: number,
  scanMode: ScanMode,
  specs: EchoWindowSpec[],
): EchoPhaseAudit {
  const priorRows = [...seedRows];
  const statuses: boolean[] = [];
  const markedRows: EchoBacktestRow[] = [];

  for (const row of validationRows) {
    const fit = fitEchoColumns(priorRows, digitCount, scanMode, specs);
    const covered = fit
      ? rowCovered(row.targetColumns, new Set(fit.columns), scanMode)
      : false;
    statuses.push(covered);
    markedRows.push({ ...row, covered, phase: "validation" });
    priorRows.push(row);
  }

  const rate = rateOf(statuses);
  const baseline = theoreticalBaselineRate(digitCount, scanMode);
  return {
    statuses,
    rows: markedRows,
    hit: statuses.filter(Boolean).length,
    total: statuses.length,
    rate,
    baselineRate: baseline,
    lift: Number((rate - baseline).toFixed(1)),
    longestMissStreak: longestMissStreak(statuses),
  };
}

export function composeEchoAudit(
  discovery: EchoColumnFit,
  validation: EchoPhaseAudit,
  holdout: EchoPhaseAudit,
): EchoAudit {
  const recentStatuses = holdout.statuses.slice(-ECHO_RECENT_SIZE);
  const allStatuses = [...discovery.statuses, ...validation.statuses, ...holdout.statuses];
  return {
    discoveryHit: discovery.hit,
    discoveryTotal: discovery.total,
    discoveryRate: discovery.rate,
    discoveryWeightedAccuracy: discovery.weightedAccuracy,
    discoveryBaselineRate: discovery.baselineRate,
    discoveryLift: discovery.lift,
    discoveryWindowStability: discovery.windowStability,
    strongestWindow: discovery.strongestWindow,
    weakestWindow: discovery.weakestWindow,
    windows: discovery.windows,
    validationHit: validation.hit,
    validationTotal: validation.total,
    validationRate: validation.rate,
    validationBaselineRate: validation.baselineRate,
    validationLift: validation.lift,
    walkForwardHit: validation.hit,
    walkForwardTotal: validation.total,
    walkForwardRate: validation.rate,
    walkForwardBaselineRate: validation.baselineRate,
    walkForwardLift: validation.lift,
    holdoutHit: holdout.hit,
    holdoutTotal: holdout.total,
    holdoutRate: holdout.rate,
    holdoutBaselineRate: holdout.baselineRate,
    holdoutLift: holdout.lift,
    recentHit: recentStatuses.filter(Boolean).length,
    recentTotal: recentStatuses.length,
    longestMissStreak: longestMissStreak(allStatuses),
  };
}

export function buildEchoBacktestRows(
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
    const prediction = predictEchoAt(draws, targetIndex, profile, scanMode, target2D, plan);
    if (!prediction) continue;
    const deret = echoDeretForMode(prediction.patokan, scanMode);
    const targetDigits = targetDigitsOf(
      draws[targetIndex],
      scanMode,
      targetPos,
      target2D,
      target3D,
    );
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
