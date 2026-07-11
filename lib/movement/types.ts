import type { Draw, Posisi } from "../engine/types";

export type MovementOutputType = "position" | "ai" | "bbfs";
export type MovementGroupTarget =
  | "2d_depan"
  | "2d_tengah"
  | "2d_belakang"
  | "3d_depan"
  | "3d_belakang"
  | "4d";
export type MovementTarget = Posisi | MovementGroupTarget;
export type MovementModel = "transition" | "motif" | "cycle" | "cross";
export type MovementStrength = "KUAT" | "CUKUP" | "PANTAU";
export type MovementRegime = "TREND" | "ZIGZAG" | "REVERSAL" | "STABIL" | "CHAOTIC";

export interface MovementConfig {
  outputType: MovementOutputType;
  target: MovementTarget;
  digitCount: number;
}

export type MovementWeights = Record<MovementModel, number>;
export type DigitDistribution = number[];
export type PositionDistributions = Record<Posisi, DigitDistribution>;

export interface MovementEvaluation {
  hit: number;
  total: number;
  rate: number;
  baseline: number;
  lift: number;
  longestMissStreak: number;
}

export interface MovementAuditRow {
  targetIndex: number;
  targetDraw: Draw;
  outputDigits: number[];
  targetDigits: number[];
  covered: boolean;
  phase: "validation" | "holdout" | "recent";
}

export interface MovementProbability {
  digit: number;
  score: number;
}

export interface MovementResult {
  config: MovementConfig & {
    targetPositions: Posisi[];
    sourceDataSize: number;
    validationSize: number;
    holdoutSize: number;
  };
  latestDraw: Draw;
  digits: number[];
  offDigits: number[];
  objective: string;
  strength: MovementStrength;
  confidence: number;
  regime: MovementRegime;
  selectedProfile: string;
  weights: MovementWeights;
  probabilities: MovementProbability[];
  evaluation: {
    validation: MovementEvaluation;
    holdout: MovementEvaluation;
    l15: MovementEvaluation;
    l30: MovementEvaluation;
    l60: MovementEvaluation;
  };
  rows: MovementAuditRow[];
  message: string;
}

export const MOVEMENT_OUTPUT_TYPES: MovementOutputType[] = ["position", "ai", "bbfs"];
export const MOVEMENT_GROUP_TARGETS: MovementGroupTarget[] = [
  "2d_depan",
  "2d_tengah",
  "2d_belakang",
  "3d_depan",
  "3d_belakang",
  "4d",
];

export function isMovementOutputType(value: unknown): value is MovementOutputType {
  return MOVEMENT_OUTPUT_TYPES.includes(value as MovementOutputType);
}

export function isMovementTarget(value: unknown): value is MovementTarget {
  return value === "A" ||
    value === "C" ||
    value === "K" ||
    value === "E" ||
    MOVEMENT_GROUP_TARGETS.includes(value as MovementGroupTarget);
}
