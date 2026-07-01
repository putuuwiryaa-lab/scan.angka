export type Posisi = "A" | "C" | "K" | "E";
export type Draw = string;
export type ScanMode = "posisi" | "ai_2d_belakang" | "bbfs_2d_belakang" | "jumlah_2d_belakang" | "off_posisi" | "off_2d_belakang" | "off_jumlah_2d_belakang";

export const KOLOM = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
export type Kolom = (typeof KOLOM)[number];

export const POS_INDEX: Record<Posisi, number> = { A: 0, C: 1, K: 2, E: 3 };

export interface EngineConfig {
  patokanPos: Posisi;
  patokanN: number;
  targetPos: Posisi;
  L: number;
  scanMode?: ScanMode;
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
  digitCount?: number;
  stopScan?: number;
  scanMode?: ScanMode;
}

export interface AutoScanItem {
  targetPos: Posisi;
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
    digitCount: number;
    stopScan: number;
    scanMode: ScanMode;
  };
  totalChecked: number;
  totalMatched: number;
  items: AutoScanItem[];
}
