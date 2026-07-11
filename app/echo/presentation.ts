import { LABEL } from "../scan/constants";
import { analysisTitle, labelsFromValues } from "../scan/helpers";
import { isShioMode } from "../shared/scan-utils";
import type { EchoConfidenceLevel, EchoFamily, EchoItem, EchoRegime } from "../../lib/echo/types";

export const FAMILY_LABEL: Record<EchoFamily, string> = {
  EL: "Echo Lokal",
  EX: "Echo Silang",
  ER: "Echo Kondisi",
  EA: "Echo Area",
  EJ: "Echo Jumlah",
  ES: "Echo Shio",
};

const REGIME_LABEL: Record<EchoRegime, string> = {
  TREND_UP: "Tren naik",
  TREND_DOWN: "Tren turun",
  ZIGZAG: "Pola zigzag",
  FLAT: "Pergerakan stabil",
  EXPANDING: "Rentang melebar",
  COMPRESSING: "Rentang menyempit",
  REPEAT: "Pola berulang",
  MIXED: "Pola campuran",
};

const CONFIDENCE_LABEL: Record<EchoConfidenceLevel, string> = {
  HIGH: "TINGGI",
  MEDIUM: "SEDANG",
  LOW: "RENDAH",
};

export function profileTitle(item: EchoItem): string {
  const anchor = item.anchorPos ? ` ${LABEL[item.anchorPos]}` : "";
  return `${FAMILY_LABEL[item.family]}${anchor}`;
}

export function regimeLabel(regime: EchoRegime): string {
  return REGIME_LABEL[regime];
}

export function confidenceLabel(level: EchoConfidenceLevel): string {
  return CONFIDENCE_LABEL[level];
}

export function buildEchoCopyText(item: EchoItem, marketName: string): string {
  const digits = labelsFromValues(item.angkaHidup, item.scanMode).join(isShioMode(item.scanMode) ? "-" : "");
  const periods = item.audit.windows.map((window) => `L${window.window} ${window.hit}/${window.total}`).join(" · ");
  return [
    `*${marketName.toUpperCase()} · ECHO ENGINE*`,
    `${analysisTitle(item.scanMode, item.targetPos, item.target2D, item.target3D)} · ${profileTitle(item)}`,
    `Rekomendasi: ${digits}`,
    `Tingkat keyakinan: ${confidenceLabel(item.confidenceLevel)} (${item.confidence})`,
    `Evaluasi awal: ${item.audit.discoveryWeightedAccuracy}% (${item.audit.discoveryLift >= 0 ? "+" : ""}${item.audit.discoveryLift}% dari acuan)`,
    periods,
    `Uji berurutan: ${item.audit.walkForwardHit}/${item.audit.walkForwardTotal} (${item.audit.walkForwardLift >= 0 ? "+" : ""}${item.audit.walkForwardLift}% dari acuan)`,
    `Verifikasi akhir: ${item.audit.holdoutHit}/${item.audit.holdoutTotal} (${item.audit.holdoutLift >= 0 ? "+" : ""}${item.audit.holdoutLift}% dari acuan)`,
    `Dukungan metode: ${item.familyAgreement}%`,
    "Performa historis tidak menjamin hasil berikutnya.",
  ].join("\n");
}
