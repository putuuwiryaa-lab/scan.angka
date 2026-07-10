import type { Draw, Kolom, Posisi, ScanMode, Target2D, Target3D } from "../engine/types";

export type EchoFamily = "EL" | "EX" | "ER" | "EA" | "EJ" | "ES";
export type EchoConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type EchoRegime = "TREND_UP" | "TREND_DOWN" | "ZIGZAG" | "FLAT" | "EXPANDING" | "COMPRESSING" | "REPEAT" | "MIXED";
export type EchoSourceKind = "position" | "jumlah2d" | "shio";
export type EchoVariant = "local" | "cross" | "regime" | "area";

export interface EchoProfile {
  family: EchoFamily;
  variant: EchoVariant;
  formula: string;
  anchorPos: Posisi | null;
  sourceKind: EchoSourceKind;
  areaPositions: Posisi[];
}

export interface EchoNeighbor {
  anchorIndex: number;
  anchorDraw: Draw;
  nextDraw: Draw;
  distance: number;
  weight: number;
  movement: number;
  projectedDigit: number;
  regime: EchoRegime;
}

export interface EchoBacktestRow {
  targetIndex: number;
  displayDraw: Draw;
  targetDraw: Draw;
  patokan: number;
  deret: number[];
  targetDigits: number[];
  targetColumns: Kolom[];
  covered: boolean;
  confidence: number;
  effectiveNeighbors: number;
}

export interface EchoWindowAudit {
  window: number;
  weight: number;
  hit: number;
  total: number;
  rate: number;
  longestMissStreak: number;
}

export interface EchoAudit {
  hit: number;
  total: number;
  recentHit: number;
  recentTotal: number;
  longestMissStreak: number;
  weightedAccuracy: number;
  windowStability: number;
  strongestWindow: number;
  weakestWindow: number;
  windows: EchoWindowAudit[];
}

export interface EchoQuality {
  neighborCount: number;
  effectiveNeighbors: number;
  meanDistance: number;
  dominantShare: number;
  stability: number;
  regime: EchoRegime;
}

export interface EchoItem {
  family: EchoFamily;
  formula: string;
  anchorPos: Posisi | null;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  scanMode: ScanMode;
  angkaHidup: number[];
  angkaMati: number[];
  kolomHidup: Kolom[];
  kolomMati: Kolom[];
  activeColumns: string;
  score: number;
  confidence: number;
  confidenceLevel: EchoConfidenceLevel;
  audit: EchoAudit;
  echo: EchoQuality;
  result: {
    latestDraw: Draw;
    patokan: number;
    deretLive: number[];
    rows: EchoBacktestRow[];
    neighbors: EchoNeighbor[];
  };
}

export interface EchoConfig {
  targetPos?: Posisi;
  target2D?: Target2D;
  target3D?: Target3D;
  digitCount?: number;
  stopScan?: number;
  scanMode?: ScanMode;
}

export interface EchoResult {
  config: {
    targetPos: Posisi;
    target2D: Target2D;
    target3D: Target3D;
    digitCount: number;
    stopScan: number;
    scanMode: ScanMode;
    auditWindows: number[];
  };
  totalProfiles: number;
  totalQualified: number;
  items: EchoItem[];
}
