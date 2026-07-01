import type { Market, ScanMode } from "./types";

export function isPositionMode(mode: ScanMode) {
  return mode === "posisi" || mode === "off_posisi";
}

export function isOffMode(mode: ScanMode) {
  return mode === "off_posisi" || mode === "off_2d_belakang" || mode === "off_jumlah_2d_belakang" || mode === "off_shio";
}

export function isShioMode(mode: ScanMode) {
  return mode === "shio" || mode === "off_shio";
}

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
