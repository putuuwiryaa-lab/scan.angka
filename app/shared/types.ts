import type { ScanMode } from "../../lib/shared/scan-mode";

export type { ScanMode } from "../../lib/shared/scan-mode";

export type Posisi = "A" | "C" | "K" | "E";
export type Target2D = "depan" | "tengah" | "belakang";

export type Market = {
  id: string;
  name: string | null;
  latestResult?: string | null;
  updatedAt?: string | null;
};

export type ScanRow = {
  displayDraw: string;
  patokanDraw: string;
  targetDraw: string;
  targetDigit: number;
  targetDigits?: number[];
  deret: number[];
};

export type ScanItem = {
  targetPos: Posisi;
  target2D: Target2D;
  scanMode: ScanMode;
  formula: string;
  angkaHidup: number[];
  kolomHidup: string[];
  activeColumns: string;
  result: {
    rows: ScanRow[];
    patokanLiveDraw: string;
    latestDraw: string;
    deretLive: number[];
  };
};

export type ScanResult = {
  config: {
    L: number;
    targetPos: Posisi;
    target2D: Target2D;
    digitCount: number;
    stopScan: number;
    scanMode: ScanMode;
  };
  totalChecked: number;
  totalMatched: number;
  items: ScanItem[];
};

export type SavedTrek = {
  id: string;
  marketId: string;
  marketName: string;
  savedAt: string;
  savedLatestDraw: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  digitCount: number;
  L: number;
  formula: string;
  kolomHidup: string[];
  activeColumns: string;
  predictionValues: number[];
  predictionText: string;
  snapshotRows?: ScanRow[];
};

export type SavedLive = {
  market: string;
  latestDraw: string;
  predictionValues: number[];
  predictionText: string;
  result: {
    rows: ScanRow[];
    latestDraw: string;
    deretLive: number[];
  };
};

export type SavedGroup = {
  key: string;
  marketName: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  digitCount: number;
  L: number;
  items: SavedTrek[];
};
