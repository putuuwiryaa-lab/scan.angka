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

export type MovementMethod =
  | "delta"
  | "motif"
  | "cycle"
  | "cross"
  | "joint_pair"
  | "momentum_decay"
  | "transition_matrix"
  | "regime_adaptive"
  | "consensus";

export type PairMovementMethod = "joint_pair";
export type PositionMovementMethod = Exclude<MovementMethod, PairMovementMethod>;
export type MovementStrength = "KUAT" | "CUKUP" | "PANTAU" | "TIDAK_LAYAK";
export type MovementRegime = "TREND" | "ZIGZAG" | "REVERSAL" | "STABIL" | "CHAOTIC";

export interface MovementConfig {
  outputType: MovementOutputType;
  target: MovementTarget;
  digitCount: number;
}

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
  phase: "walk_forward";
}

export interface MovementProbability {
  digit: number;
  score: number;
}

export interface MovementTournamentCandidate {
  method: MovementMethod;
  window: number;
  evaluation: MovementEvaluation;
  l7Hit: number;
  l3Hit: number;
  neighborAverageHit: number;
  meanProbability: number;
}

export interface MovementResult {
  config: MovementConfig & {
    targetPositions: Posisi[];
    sourceDataSize: number;
    walkForwardSize: 14;
    windows: number[];
    candidateCount: number;
  };
  latestDraw: Draw;
  released: boolean;
  digits: number[];
  offDigits: number[];
  objective: string;
  strength: MovementStrength;
  confidence: number;
  regime: MovementRegime;
  selectedMethod: MovementMethod;
  selectedWindow: number;
  minimumReleaseHits: number;
  probabilities: MovementProbability[];
  evaluation: {
    l14: MovementEvaluation;
    l7: MovementEvaluation;
    l3: MovementEvaluation;
  };
  tournament: MovementTournamentCandidate[];
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

export const POSITION_MOVEMENT_METHODS: PositionMovementMethod[] = [
  "delta",
  "motif",
  "cycle",
  "cross",
  "momentum_decay",
  "transition_matrix",
  "regime_adaptive",
  "consensus",
];

export const PAIR_MOVEMENT_METHODS: PairMovementMethod[] = ["joint_pair"];
export const MOVEMENT_METHODS: MovementMethod[] = [
  ...POSITION_MOVEMENT_METHODS,
  ...PAIR_MOVEMENT_METHODS,
];

export const MOVEMENT_METHOD_LABELS: Record<MovementMethod, string> = {
  delta: "Delta Movement",
  motif: "Pattern Motif",
  cycle: "Cycle Analysis",
  cross: "Cross Position",
  joint_pair: "Joint Pair",
  momentum_decay: "Momentum Decay",
  transition_matrix: "Transition Matrix",
  regime_adaptive: "Regime Adaptive",
  consensus: "Consensus Ensemble",
};

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
