import { LABEL } from "../scan/constants";
import { analysisTitle, labelsFromValues } from "../scan/helpers";
import { isShioMode } from "../shared/scan-utils";
import type { EchoFamily, EchoItem } from "../../lib/echo/types";

export const FAMILY_LABEL: Record<EchoFamily, string> = {
  EL: "Echo Lokal",
  EX: "Echo Silang",
  ER: "Echo Rezim",
  EA: "Echo Area",
  EJ: "Echo Jumlah",
  ES: "Echo Shio",
};

export function profileTitle(item: EchoItem): string {
  const anchor = item.anchorPos ? ` ${LABEL[item.anchorPos]}` : "";
  return `${FAMILY_LABEL[item.family]}${anchor}`;
}

export function buildEchoCopyText(item: EchoItem, marketName: string): string {
  const digits = labelsFromValues(item.angkaHidup, item.scanMode).join(isShioMode(item.scanMode) ? "-" : "");
  const discovery = item.audit.windows.map((window) => `L${window.window} ${window.hit}/${window.total}`).join(" · ");
  return [
    `*${marketName.toUpperCase()} · ECHO ENGINE*`,
    `${analysisTitle(item.scanMode, item.targetPos, item.target2D, item.target3D)} · ${profileTitle(item)}`,
    `Output: ${digits}`,
    `Discovery: ${item.audit.discoveryWeightedAccuracy}% (${item.audit.discoveryLift >= 0 ? "+" : ""}${item.audit.discoveryLift}%)`,
    discovery,
    `Nested walk-forward: ${item.audit.walkForwardHit}/${item.audit.walkForwardTotal} (${item.audit.walkForwardLift >= 0 ? "+" : ""}${item.audit.walkForwardLift}%)`,
    `Final holdout: ${item.audit.holdoutHit}/${item.audit.holdoutTotal} (${item.audit.holdoutLift >= 0 ? "+" : ""}${item.audit.holdoutLift}%)`,
    `Recent final: ${item.audit.recentHit}/${item.audit.recentTotal}`,
    `Keyakinan live: ${item.confidenceLevel} ${item.confidence}`,
    `Konsensus keluarga: ${item.familyAgreement}%`,
  ].join("\n");
}
