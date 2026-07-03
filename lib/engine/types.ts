import type { ScanMode } from "../shared/scan-mode";
import { KOLOM, SHIO_KOLOM } from "../shared/columns";

export type { ScanMode } from "../shared/scan-mode";
export { KOLOM, SHIO_KOLOM } from "../shared/columns";

export type Posisi = "A" | "C" | "K" | "E";
export type Draw = string;
export type Target2D = "depan" | "tengah" | "belakang";
export type Target3D = "depan" | "belakang";

export type DigitKolom = (typeof KOLOM)[number];
export type ShioKolom = (typeof SHIO_KOLOM)[number];
export type Kolom = DigitKolom | ShioKolom;

export const POS_INDEX: Record<Posisi, number> = { A: 0, C: 1, K: 2, E: 3 };

export interface EngineConfig {
  patokanPos: Posisi;
  patokanN: number;
  targetPos: Posisi;
  L: number;
  scanMode?: ScanMode;
  target2D?: Target2D;
  target3D?: Target3D;
}

export interface KolomStat {
  kolom: Kolom;
  hit: number;
  lemah: boolean;
  digitLive: number;
}

export interface BacktestRow {
  displayDraw: Draw;
  patokanDraw: Draw;
  targetDraw: Draw;
  patokan: number;
  deret: number[];
  targetDigit: number;
  targetDigits: number[];
  kolomKena: Kolom;
}

export interface EngineResult {
  config: EngineConfig;
  jumlahData: number;
  jumlahBacktest: number;
  kolom: KolomStat[];
  deretLive: number[];
  patokanLiveDraw: Draw;
  latestDraw: Draw;
  angkaKuat: number[];
  angkaMati: number[];
  rows: BacktestRow[];
}

export interface AutoScanConfig {
  L: number;
  targetPos?: Posisi;
  target2D?: Target2D;
  target3D?: Target3D;
  digitCount?: number;
  stopScan?: number;
  scanMode?: ScanMode;
}

export interface AutoScanItem {
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  scanMode: ScanMode;
  patokanPos: Posisi;
  patokanN: number;
  formula: string;
  code: string;
  angkaHidup: number[];
  kolomHidup: Kolom[];
  angkaMati: number[];
  kolomMati: Kolom[];
  activeColumns: string;
  jumlahHidup: number;
  coreSize?: number;
  coreColumns?: Kolom[];
  supportColumns?: Kolom[];
  supportReasons?: string[];
  consensusDigits?: number[];
  consensusOverlap?: number;
  consensusWeight?: number;
  result: EngineResult;
}

export interface AutoScanResult {
  config: {
    L: number;
    targetPos: Posisi;
    target2D: Target2D;
    target3D: Target3D;
    digitCount: number;
    stopScan: number;
    scanMode: ScanMode;
  };
  totalChecked: number;
  totalMatched: number;
  items: AutoScanItem[];
}
