import { ANALYSIS_LABEL, LABEL, TARGET_2D_LABEL } from "../scan/constants";
import { isPositionMode, isShioMode } from "../scan/helpers";
import type { Market, Posisi, ScanMode, Target2D } from "../scan/types";

export function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

export function batchMarketTitle(market: Market) {
  return titleCase(market.name ?? market.id);
}

export function outputTitle(scanMode: ScanMode, targetPos: Posisi, target2D: Target2D, digitCount: number) {
  const target = isPositionMode(scanMode) ? LABEL[targetPos] : TARGET_2D_LABEL[target2D];
  return `${ANALYSIS_LABEL[scanMode]} ${target} ${digitCount}${isShioMode(scanMode) ? " Shio" : "D"}`;
}
