import { KOLOM } from "./types";
import { POSISI } from "./constants";
import { digitsFromDeretColumns, isOffMode, rowTargetColumns, uniqueDigits } from "./helpers";
import type { AutoScanItem, EngineResult, Kolom, ScanMode } from "./types";

export type RankedItem = AutoScanItem & {
  typeOrder: number;
  strength: number;
  rankCoreSize: number;
  hitScore: number;
  recentScore: number;
  consensusOverlap: number;
  consensusWeight: number;
  consensusDigits: number[];
};

interface ConsensusProfile {
  digits: number[];
  counts: number[];
}

export interface CompressionProfile {
  displayColumns: Kolom[];
  coreColumns: Kolom[];
  supportColumns: Kolom[];
  supportReasons: string[];
  coreSize: number;
  hitScore: number;
  recentScore: number;
}

function columnHit(result: EngineResult, column: Kolom): number {
  return result.kolom.find((k) => k.kolom === column)?.hit ?? 0;
}

function columnsHitScore(result: EngineResult, columns: Kolom[]): number {
  return columns.reduce((sum, column) => sum + columnHit(result, column), 0);
}

function targetCoverCount(targetColumns: Kolom[], columns: Set<Kolom>): number {
  return targetColumns.filter((column) => columns.has(column)).length;
}

function requiredAiCover(targetColumns: Kolom[], scanMode: ScanMode): number {
  return scanMode === "ai_3d" ? Math.min(2, targetColumns.length) : 1;
}

function aiRowCovered(row: EngineResult["rows"][number], columns: Set<Kolom>, scanMode: ScanMode): boolean {
  const targetColumns = rowTargetColumns(row);
  return targetCoverCount(targetColumns, columns) >= requiredAiCover(targetColumns, scanMode);
}

function columnCombinations(size: number): Kolom[][] {
  const columns = [...KOLOM] as Kolom[];
  const result: Kolom[][] = [];
  function walk(start: number, current: Kolom[]) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let index = start; index < columns.length; index += 1) {
      current.push(columns[index]);
      walk(index + 1, current);
      current.pop();
    }
  }
  walk(0, []);
  return result;
}

function coreColumnsForAi(result: EngineResult, digitCount: number, scanMode: ScanMode): Kolom[] {
  let best: Kolom[] = [];
  let bestRecent = -1;
  let bestHit = -1;

  for (const columns of columnCombinations(digitCount)) {
    const columnSet = new Set(columns);
    if (!result.rows.every((row) => aiRowCovered(row, columnSet, scanMode))) continue;

    const recent = result.rows.slice(-5).filter((row) => aiRowCovered(row, columnSet, scanMode)).length;
    const hit = columnsHitScore(result, columns);
    if (recent > bestRecent || (recent === bestRecent && hit > bestHit)) {
      best = columns;
      bestRecent = recent;
      bestHit = hit;
    }
  }

  return best;
}

function coreColumns(result: EngineResult, digitCount: number, scanMode: ScanMode): Kolom[] {
  if (scanMode === "ai_2d_belakang" || scanMode === "ai_3d") return coreColumnsForAi(result, digitCount, scanMode);
  const columns = result.kolom.filter((k) => isOffMode(scanMode) ? k.lemah : !k.lemah).map((k) => k.kolom as Kolom);
  return columns.length === digitCount ? columns : [];
}

function rowCovered(row: EngineResult["rows"][number], columns: Set<Kolom>, scanMode: ScanMode): boolean {
  const targetColumns = rowTargetColumns(row);
  if (isOffMode(scanMode)) return targetColumns.every((column) => !columns.has(column));
  if (scanMode === "ai_2d_belakang" || scanMode === "ai_3d") return targetCoverCount(targetColumns, columns) >= requiredAiCover(targetColumns, scanMode);
  return targetColumns.every((column) => columns.has(column));
}

function recentScore(result: EngineResult, columns: Kolom[], scanMode: ScanMode): number {
  const columnSet = new Set(columns);
  return result.rows.slice(-5).filter((row) => rowCovered(row, columnSet, scanMode)).length;
}

export function compressionProfile(result: EngineResult, digitCount: number, scanMode: ScanMode): CompressionProfile | null {
  const core = coreColumns(result, digitCount, scanMode);
  if (core.length !== digitCount) return null;

  return {
    displayColumns: core,
    coreColumns: core,
    supportColumns: [],
    supportReasons: [],
    coreSize: core.length,
    hitScore: columnsHitScore(result, core),
    recentScore: recentScore(result, core, scanMode),
  };
}

export function digitsFromColumns(result: EngineResult, columns: Kolom[]): number[] {
  return columns.map((column) => result.kolom.find((k) => k.kolom === column)?.digitLive).filter((digit): digit is number => Number.isFinite(digit));
}

function normalizedTrekDigits(digits: number[]): string {
  return uniqueDigits(digits).sort((a, b) => a - b).join(":");
}

function trekSignature(item: AutoScanItem): string {
  const rows = item.result.rows.map((row) => normalizedTrekDigits(digitsFromDeretColumns(row.deret, item.kolomHidup)));
  return `${item.scanMode}:${item.targetPos}:${item.target2D}:${item.target3D}:${rows.join("|")}`;
}

function consensusProfile(items: AutoScanItem[], digitCount: number): ConsensusProfile {
  const maxDigit = items.reduce((max, item) => Math.max(max, ...item.angkaHidup), 9);
  const counts = Array.from({ length: Math.max(10, maxDigit + 1) }, () => 0);
  for (const item of items) {
    for (const digit of uniqueDigits(item.angkaHidup)) {
      if (digit >= 0 && digit < counts.length) counts[digit] += 1;
    }
  }
  const digits = counts.map((count, digit) => ({ digit, count })).sort((a, b) => b.count - a.count || a.digit - b.digit).slice(0, digitCount).map((item) => item.digit);
  return { digits, counts };
}

export function applyConsensusScores(items: RankedItem[], digitCount: number): void {
  const profile = consensusProfile(items, digitCount);
  const consensusSet = new Set(profile.digits);
  for (const item of items) {
    const digits = uniqueDigits(item.angkaHidup);
    item.consensusDigits = profile.digits;
    item.consensusOverlap = digits.filter((digit) => consensusSet.has(digit)).length;
    item.consensusWeight = digits.reduce((sum, digit) => sum + (profile.counts[digit] ?? 0), 0);
  }
}

function baseRank(a: RankedItem, b: RankedItem): number {
  return b.recentScore - a.recentScore ||
    b.hitScore - a.hitScore ||
    a.typeOrder - b.typeOrder ||
    POSISI.indexOf(a.targetPos) - POSISI.indexOf(b.targetPos) ||
    POSISI.indexOf(a.patokanPos) - POSISI.indexOf(b.patokanPos) ||
    a.patokanN - b.patokanN ||
    a.formula.localeCompare(b.formula);
}

export function finalRank(a: RankedItem, b: RankedItem): number {
  return b.consensusOverlap - a.consensusOverlap ||
    b.consensusWeight - a.consensusWeight ||
    b.recentScore - a.recentScore ||
    b.hitScore - a.hitScore ||
    a.typeOrder - b.typeOrder ||
    POSISI.indexOf(a.targetPos) - POSISI.indexOf(b.targetPos) ||
    POSISI.indexOf(a.patokanPos) - POSISI.indexOf(b.patokanPos) ||
    a.patokanN - b.patokanN ||
    a.formula.localeCompare(b.formula);
}

export function dedupeTrekCandidates(items: RankedItem[]): RankedItem[] {
  const seen = new Set<string>();
  const unique: RankedItem[] = [];
  for (const item of [...items].sort(baseRank)) {
    const signature = trekSignature(item);
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(item);
  }
  return unique;
}
