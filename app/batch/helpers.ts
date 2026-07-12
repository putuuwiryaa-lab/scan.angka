import {
  ADAPTIVE_BATCH_OPTIONS,
  adaptiveTargetKind,
  isAdaptiveBatchMode,
  type BatchAnalysisMode,
} from "../../lib/shared/batch-analysis";
import { ANALYSIS_LABEL, LABEL, TARGET_2D_LABEL, TARGET_3D_LABEL } from "../shared/scan-options";
import { is3DMode, isPositionMode, isShioMode } from "../shared/scan-utils";
import type { Market, Posisi, ScanMode, Target2D, Target3D } from "../shared/types";

export function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

export function batchMarketTitle(market: Market) {
  return titleCase(market.name ?? market.id);
}

export function outputTitle(mode: BatchAnalysisMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D, digitCount: number) {
  if (isAdaptiveBatchMode(mode)) {
    const label = ADAPTIVE_BATCH_OPTIONS.find((item) => item.value === mode)?.label ?? mode;
    const kind = adaptiveTargetKind(mode);
    const target = kind === "position"
      ? LABEL[targetPos]
      : kind === "2d"
        ? TARGET_2D_LABEL[target2D]
        : kind === "3d"
          ? TARGET_3D_LABEL[target3D]
          : "";
    return [label, target, `${digitCount}D`].filter(Boolean).join(" ");
  }

  const scanMode = mode as ScanMode;
  const target = isPositionMode(scanMode) ? LABEL[targetPos] : is3DMode(scanMode) ? TARGET_3D_LABEL[target3D] : TARGET_2D_LABEL[target2D];
  return `${ANALYSIS_LABEL[scanMode]} ${target} ${digitCount}${isShioMode(scanMode) ? " Shio" : "D"}`;
}
