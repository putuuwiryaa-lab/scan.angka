import type { Posisi } from "../engine/types";
import type {
  MovementGroupTarget,
  MovementOutputType,
  MovementTarget,
} from "../movement/types";
import { isScanMode, type ScanMode } from "./scan-mode";

export const ADAPTIVE_BATCH_MODES = [
  "adaptive_position",
  "adaptive_ai_2d",
  "adaptive_bbfs_2d",
  "adaptive_ai_3d",
  "adaptive_bbfs_3d",
  "adaptive_ai_4d",
  "adaptive_bbfs_4d",
] as const;

export type AdaptiveBatchMode = (typeof ADAPTIVE_BATCH_MODES)[number];
export type BatchAnalysisMode = ScanMode | AdaptiveBatchMode;
export type BatchTarget2D = "depan" | "tengah" | "belakang";
export type BatchTarget3D = "depan" | "belakang";

export const ADAPTIVE_BATCH_OPTIONS: { value: AdaptiveBatchMode; label: string }[] = [
  { value: "adaptive_position", label: "Adaptif Posisi" },
  { value: "adaptive_ai_2d", label: "Adaptif AI 2D" },
  { value: "adaptive_bbfs_2d", label: "Adaptif BBFS 2D" },
  { value: "adaptive_ai_3d", label: "Adaptif AI 3D" },
  { value: "adaptive_bbfs_3d", label: "Adaptif BBFS 3D" },
  { value: "adaptive_ai_4d", label: "Adaptif AI 4D" },
  { value: "adaptive_bbfs_4d", label: "Adaptif BBFS 4D" },
];

export const MAX_ADAPTIVE_BATCH_MARKETS = 35;
export const ADAPTIVE_BATCH_CHUNK_SIZE = 5;

export function isAdaptiveBatchMode(value: unknown): value is AdaptiveBatchMode {
  return typeof value === "string" && (ADAPTIVE_BATCH_MODES as readonly string[]).includes(value);
}

export function isBatchAnalysisMode(value: unknown): value is BatchAnalysisMode {
  return isScanMode(value) || isAdaptiveBatchMode(value);
}

export function adaptiveOutputType(mode: AdaptiveBatchMode): MovementOutputType {
  if (mode === "adaptive_position") return "position";
  if (mode.includes("_ai_")) return "ai";
  return "bbfs";
}

export function adaptiveTarget(
  mode: AdaptiveBatchMode,
  targetPos: Posisi,
  target2D: BatchTarget2D,
  target3D: BatchTarget3D,
): MovementTarget {
  if (mode === "adaptive_position") return targetPos;
  if (mode.endsWith("_2d")) return `2d_${target2D}` as MovementGroupTarget;
  if (mode.endsWith("_3d")) return `3d_${target3D}` as MovementGroupTarget;
  return "4d";
}

export function adaptiveTargetKind(mode: AdaptiveBatchMode): "position" | "2d" | "3d" | "4d" {
  if (mode === "adaptive_position") return "position";
  if (mode.endsWith("_2d")) return "2d";
  if (mode.endsWith("_3d")) return "3d";
  return "4d";
}

export function minimumAdaptiveDigitCount(mode: AdaptiveBatchMode): number {
  if (adaptiveOutputType(mode) !== "bbfs") return 1;
  const kind = adaptiveTargetKind(mode);
  if (kind === "4d") return 4;
  if (kind === "3d") return 3;
  return 2;
}

export function clampBatchDigitCount(mode: BatchAnalysisMode, value: number): number {
  const safe = Number.isFinite(value) ? Math.trunc(value) : 1;
  if (isAdaptiveBatchMode(mode)) {
    return Math.max(minimumAdaptiveDigitCount(mode), Math.min(9, safe));
  }
  const maximum = mode === "shio" || mode === "off_shio" ? 12 : 9;
  return Math.max(1, Math.min(maximum, safe));
}

export function batchModeUsesFixedTarget(mode: BatchAnalysisMode): boolean {
  return isAdaptiveBatchMode(mode) && adaptiveTargetKind(mode) === "4d";
}

export function batchModeUsesWalkForward(mode: BatchAnalysisMode): boolean {
  return isAdaptiveBatchMode(mode);
}
