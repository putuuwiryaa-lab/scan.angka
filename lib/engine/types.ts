export type Posisi = "A" | "C" | "K" | "E";
export type Draw = string;

export const KOLOM = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
export type Kolom = (typeof KOLOM)[number];

export const POS_INDEX: Record<Posisi, number> = { A: 0, C: 1, K: 2, E: 3 };

export interface EngineConfig {
  patokanPos: Posisi;
  patokanN: number;
  targetPos: Posisi;
  L: number;
}

export interface KolomStat {
  kolom: Kolom;
  hit: number;
  lemah: boolean;
  digitLive: number;
}

export interface BacktestRow {
  patokanDraw: Draw;
  targetDraw: Draw;
  patokan: number;
  deret: number[];
  targetDigit: number;
  kolomKena: Kolom;
}

export interface EngineResult {
  config: EngineConfig;
  jumlahData: number;
  jumlahBacktest: number;
  kolom: KolomStat[];
  deretLive: number[];
  patokanLiveDraw: Draw;
  angkaKuat: number[];
  angkaMati: number[];
  rows: BacktestRow[];
}

export interface AutoScanConfig {
  L: number;
  targetPos?: Posisi;
  minMati?: number;
  stopScan?: number;
}

export interface AutoScanItem {
  targetPos: Posisi;
  patokanPos: Posisi;
  patokanN: number;
  formula: string;
  code: string;
  angkaMati: number[];
  kolomMati: Kolom[];
  angkaKuat: number[];
  activeColumns: string;
  jumlahMati: number;
  result: EngineResult;
}

export interface AutoScanResult {
  config: Required<AutoScanConfig>;
  totalChecked: number;
  totalMatched: number;
  items: AutoScanItem[];
}
