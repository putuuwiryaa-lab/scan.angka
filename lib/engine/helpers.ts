import { KOLOM, POS_INDEX, type BacktestRow, type Draw, type Kolom, type Posisi, type ScanMode } from "./types";

export function parseHistory(historyData: string): Draw[] {
  return historyData.trim().split(/\s+/).filter((tok) => /^\d{4}$/.test(tok));
}

export function digitOf(draw: Draw, pos: Posisi): number {
  return Number(draw[POS_INDEX[pos]]);
}

export function mod10(value: number): number {
  return ((value % 10) + 10) % 10;
}

export function buildDeret(start: number): number[] {
  return Array.from({ length: 10 }, (_, i) => (start + i) % 10);
}

export function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function scanModeOrDefault(value: unknown): ScanMode {
  return value === "ai_2d_belakang" || value === "bbfs_2d_belakang" || value === "jumlah_2d_belakang" ? value : "posisi";
}

export function uniqueDigits(digits: number[]): number[] {
  return [...new Set(digits.filter((digit) => Number.isFinite(digit)))];
}

export function jumlah2dDigit(left: number, right: number): number {
  const total = left + right;
  return total >= 10 ? Math.floor(total / 10) + (total % 10) : total;
}

export function targetDigitsOf(draw: Draw, mode: ScanMode, targetPos: Posisi): number[] {
  if (mode === "ai_2d_belakang" || mode === "bbfs_2d_belakang") return uniqueDigits([digitOf(draw, "K"), digitOf(draw, "E")]);
  if (mode === "jumlah_2d_belakang") return [jumlah2dDigit(digitOf(draw, "K"), digitOf(draw, "E"))];
  return [digitOf(draw, targetPos)];
}

export function offsetSuffix(offset: number): string {
  return `${offset > 0 ? "+" : ""}${offset}`;
}

export function offsetLabel(pos: Posisi, N: number, offset: number): string {
  return offset === 0 ? `${pos}${N}` : `${pos}${N}${offsetSuffix(offset)}`;
}

export function scanCode(target: Posisi, formula: string, L: number, columns: string, mode: ScanMode): string {
  const prefix = mode === "ai_2d_belakang" ? "ai2db" : mode === "bbfs_2d_belakang" ? "bbfs2db" : mode === "jumlah_2d_belakang" ? "jml2db" : target.toLowerCase();
  return `#${prefix}_${formula}_L${L}-P0-D0_${columns || "-"}`;
}

export function digitsFromDeretColumns(deret: number[], columns: Kolom[]): number[] {
  return columns.map((column) => deret[KOLOM.indexOf(column)]).filter((digit): digit is number => Number.isFinite(digit));
}

export function rowTargetColumns(row: BacktestRow): Kolom[] {
  const columns = uniqueDigits(row.targetDigits).map((digit) => KOLOM[(digit - row.patokan + 10) % 10]);
  return [...new Set(columns)];
}
