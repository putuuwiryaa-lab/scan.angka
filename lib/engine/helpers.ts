import { KOLOM, POS_INDEX, type BacktestRow, type Draw, type Kolom, type Posisi, type ScanMode, type Target2D } from "./types";

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

export function isScanMode(value: unknown): value is ScanMode {
  return value === "posisi" ||
    value === "ai_2d_belakang" ||
    value === "bbfs_2d_belakang" ||
    value === "jumlah_2d_belakang" ||
    value === "off_posisi" ||
    value === "off_2d_belakang" ||
    value === "off_jumlah_2d_belakang";
}

export function isTarget2D(value: unknown): value is Target2D {
  return value === "depan" || value === "tengah" || value === "belakang";
}

export function target2DOrDefault(value: unknown): Target2D {
  return isTarget2D(value) ? value : "belakang";
}

export function isOffMode(mode: ScanMode): boolean {
  return mode === "off_posisi" || mode === "off_2d_belakang" || mode === "off_jumlah_2d_belakang";
}

export function is2DMode(mode: ScanMode): boolean {
  return mode === "ai_2d_belakang" ||
    mode === "bbfs_2d_belakang" ||
    mode === "jumlah_2d_belakang" ||
    mode === "off_2d_belakang" ||
    mode === "off_jumlah_2d_belakang";
}

export function scanModeOrDefault(value: unknown): ScanMode {
  return isScanMode(value) ? value : "posisi";
}

export function uniqueDigits(digits: number[]): number[] {
  return [...new Set(digits.filter((digit) => Number.isFinite(digit)))];
}

export function jumlah2dDigit(left: number, right: number): number {
  const total = left + right;
  return total >= 10 ? Math.floor(total / 10) + (total % 10) : total;
}

function target2DPositions(target2D: Target2D): [Posisi, Posisi] {
  if (target2D === "depan") return ["A", "C"];
  if (target2D === "tengah") return ["C", "K"];
  return ["K", "E"];
}

export function targetDigitsOf(draw: Draw, mode: ScanMode, targetPos: Posisi, target2D: Target2D = "belakang"): number[] {
  if (mode === "ai_2d_belakang" || mode === "bbfs_2d_belakang" || mode === "off_2d_belakang") {
    const [left, right] = target2DPositions(target2D);
    return uniqueDigits([digitOf(draw, left), digitOf(draw, right)]);
  }
  if (mode === "jumlah_2d_belakang" || mode === "off_jumlah_2d_belakang") {
    const [left, right] = target2DPositions(target2D);
    return [jumlah2dDigit(digitOf(draw, left), digitOf(draw, right))];
  }
  return [digitOf(draw, targetPos)];
}

export function offsetSuffix(offset: number): string {
  return `${offset > 0 ? "+" : ""}${offset}`;
}

export function offsetLabel(pos: Posisi, N: number, offset: number): string {
  return offset === 0 ? `${pos}${N}` : `${pos}${N}${offsetSuffix(offset)}`;
}

export function scanCode(target: Posisi, formula: string, L: number, columns: string, mode: ScanMode, target2D: Target2D = "belakang"): string {
  const area = target2D === "depan" ? "d" : target2D === "tengah" ? "t" : "b";
  const prefix = mode === "ai_2d_belakang" ? `ai2d${area}` :
    mode === "bbfs_2d_belakang" ? `bbfs2d${area}` :
    mode === "jumlah_2d_belakang" ? `jml2d${area}` :
    mode === "off_posisi" ? `off${target.toLowerCase()}` :
    mode === "off_2d_belakang" ? `off2d${area}` :
    mode === "off_jumlah_2d_belakang" ? `offjml2d${area}` :
    target.toLowerCase();
  return `#${prefix}_${formula}_L${L}-P0-D0_${columns || "-"}`;
}

export function digitsFromDeretColumns(deret: number[], columns: Kolom[]): number[] {
  return columns.map((column) => deret[KOLOM.indexOf(column)]).filter((digit): digit is number => Number.isFinite(digit));
}

export function rowTargetColumns(row: BacktestRow): Kolom[] {
  const columns = uniqueDigits(row.targetDigits).map((digit) => KOLOM[(digit - row.patokan + 10) % 10]);
  return [...new Set(columns)];
}
