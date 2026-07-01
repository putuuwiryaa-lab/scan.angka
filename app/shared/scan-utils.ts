import type { Market } from "./types";

export { isOffMode, isPositionMode, isScanMode, isShioMode } from "../../lib/shared/scan-mode";

export function marketTitle(market: Market) {
  return market.name ?? market.id;
}

export function cleanDigits(value: string, maxLength = 3) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function clampTextNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}
