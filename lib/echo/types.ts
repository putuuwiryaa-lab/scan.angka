import type { Draw, Kolom, Posisi, ScanMode, Target2D, Target3D } from "../engine/types";

export type EchoFamily = "EL" | "EX" | "ER" | "EA" | "EJ" | "ES" | "ET" | "EC" | "EP";
export type EchoConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type EchoStrength = "KUAT" | "CUKUP" | "PANTAU";
export type EchoRegime = "TREND_UP" | "TREND_DOWN" | "ZIGZAG" | "FLAT" | "EXPANDING" | "COMPRESSING" | "REPEAT" | "MIXED";
export type EchoSourceKind = "position" | "jumlah2d" | "shio";
export type EchoVariant = "local" | "cross" | "regime" | "area" | "transition1" | "transition2" | "transitionCross" | "cycleGap" | "cyclePhase" | "pairGap" | "pairSum" | "pairRelation";
export type EchoAuditPhase = "discovery" | "validation" | "holdout";
export type EchoRejectReason =
  | "NO_QUALIFIED_PROFILE"
  | "SCORE_BELOW_MINIMUM"
  | "NEGATIVE_DISCOVERY_LIFT"
  | "NEGATIVE_VALIDATION_LIFT"
  | "LOW_CONFIDENCE"
  | "LOW_EFFECTIVE_SAMPLE"
  | "INSUFFICIENT_VALIDATION"
  | "INSUFFICIENT_HOLDOUT"
  | "HOLDOUT_HIT_BELOW_BASELINE"
  | "NEGATIVE_HOLDOUT_LIFT"
  | "EXCESSIVE_VALIDATION_DROP"
  | "HOLDOUT_MISS_STREAK"
  | "LOW_FINAL_SCORE";

export interface EchoDiagnostic {
  code: EchoRejectReason;
  phase: "candidate" | "holdout";
  label: string;
  actual?: number;
  required?: number;
  detail: string;
}

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
  phase: EchoAuditPhase;
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
  discoveryHit: number;
  discoveryTotal: number;
  discoveryRate: number;
  discoveryWeightedAccuracy: number;
  discoveryBaselineRate: number;
  discoveryLift: number;
  discoveryWindowStability: number;
  strongestWindow: number;
  weakestWindow: number;
  windows: EchoWindowAudit[];
  validationHit: number;
  validationTotal: number;
  validationRate: number;
  validationBaselineRate: number;
  validationLift: number;
  walkForwardHit: number;
  walkForwardTotal: number;
  walkForwardRate: number;
  walkForwardBaselineRate: number;
  walkForwardLift: number;
  holdoutHit: number;
  holdoutTotal: number;
  holdoutRate: number;
  holdoutBaselineRate: number;
  holdoutLift: number;
  recentHit: number;
  recentTotal: number;
  longestMissStreak: number;
}

export interface EchoQuality {
  neighborCount: number;
  effectiveNeighbors: number;
  meanDistance: number;
  dominantShare: number;
  stability: number;
  ensembleStability: number;
  regimeAgreement: number;
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
  strength: EchoStrength;
  confidence: number;
  confidenceLevel: EchoConfidenceLevel;
  familyAgreement: number;
  consensusFamilies: EchoFamily[];
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
  scanMode?: ScanMode;
}

export interface EchoResult {
  config: {
    targetPos: Posisi;
    target2D: Target2D;
    target3D: Target3D;
    digitCount: number;
    scanMode: ScanMode;
    discoveryWindows: number[];
    validationSize: number;
    holdoutSize: number;
    evaluationRows: number;
    sourceDataSize: number;
    nestedWalkForward: boolean;
    finalHoldoutUsedForSelection: boolean;
    finalHoldoutUsedAsReleaseGate: boolean;
  };
  totalProfiles: number;
  totalQualified: number;
  message: string;
  diagnostics: EchoDiagnostic[];
  items: EchoItem[];
}
