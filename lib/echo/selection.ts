import type { EchoColumnFit, EchoPhaseAudit, EchoRowSplit } from "./audit";
import type { EchoPrediction } from "./pattern";
import type { EchoBacktestRow, EchoFamily, EchoFamilyGroup, EchoProfile } from "./types";

export interface EchoSelectableCandidate {
  profile: EchoProfile;
  rows: EchoBacktestRow[];
  split: EchoRowSplit;
  discoveryFit: EchoColumnFit;
  validation: EchoPhaseAudit;
  productionFit: EchoColumnFit;
  live: EchoPrediction;
  liveDigits: number[];
  score: number;
}

export function familyGroupOf(family: EchoFamily): EchoFamilyGroup {
  if (family === "ET") return "TRANSITION";
  if (family === "EC") return "CYCLE";
  if (family === "EP") return "PAIR";
  if (family === "EF") return "FREQUENCY";
  if (family === "EM") return "MOMENTUM";
  if (family === "EN") return "ENSEMBLE";
  return "ANALOG";
}

function weakestWindowRate(candidate: EchoSelectableCandidate): number {
  return candidate.discoveryFit.windows.reduce(
    (minimum, window) => Math.min(minimum, window.rate),
    100,
  );
}

function rankDiscovery(left: EchoSelectableCandidate, right: EchoSelectableCandidate): number {
  return right.discoveryFit.lift - left.discoveryFit.lift ||
    right.discoveryFit.weightedAccuracy - left.discoveryFit.weightedAccuracy ||
    weakestWindowRate(right) - weakestWindowRate(left) ||
    right.discoveryFit.windowStability - left.discoveryFit.windowStability ||
    left.discoveryFit.longestMissStreak - right.discoveryFit.longestMissStreak ||
    left.profile.formula.localeCompare(right.profile.formula);
}

export function selectFamilyRepresentatives<T extends EchoSelectableCandidate>(candidates: T[]): T[] {
  const grouped = new Map<EchoFamilyGroup, T[]>();
  for (const candidate of candidates) {
    const group = familyGroupOf(candidate.profile.family);
    if (group === "ENSEMBLE") continue;
    const current = grouped.get(group) ?? [];
    current.push(candidate);
    grouped.set(group, current);
  }

  return [...grouped.values()]
    .map((members) => [...members].sort(rankDiscovery)[0])
    .filter((candidate): candidate is T => Boolean(candidate));
}

export function rankFamilyRepresentatives<T extends EchoSelectableCandidate>(representatives: T[]): T[] {
  return [...representatives].sort((left, right) =>
    right.score - left.score ||
    right.validation.lift - left.validation.lift ||
    right.validation.rate - left.validation.rate ||
    right.discoveryFit.lift - left.discoveryFit.lift ||
    right.live.confidence - left.live.confidence ||
    left.profile.formula.localeCompare(right.profile.formula));
}
