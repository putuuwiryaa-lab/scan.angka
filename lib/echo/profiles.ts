import { is3DMode, isJumlah2DMode, isShioMode, target2DPositions, target3DPositions } from "../engine/helpers";
import type { Posisi, ScanMode, Target2D, Target3D } from "../engine/types";
import type { EchoFamily, EchoProfile, EchoVariant } from "./types";

function areaForMode(mode: ScanMode, target2D: Target2D, target3D: Target3D): Posisi[] {
  if (is3DMode(mode)) return [...target3DPositions(target3D)];
  if (mode === "posisi" || mode === "off_posisi") return [];
  return [...target2DPositions(target2D)];
}

export function buildEchoProfiles(scanMode: ScanMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D): EchoProfile[] {
  const profiles: EchoProfile[] = [];
  const area = areaForMode(scanMode, target2D, target3D);
  const add = (
    family: EchoFamily,
    variant: EchoVariant,
    formula: string,
    anchorPos: Posisi | null,
    sourceKind: EchoProfile["sourceKind"],
  ) => profiles.push({ family, variant, formula, anchorPos, sourceKind, areaPositions: area });

  if (isShioMode(scanMode)) {
    add("ES", "local", `ES-L-${target2D[0].toUpperCase()}`, null, "shio");
    add("ES", "cross", `ES-X-${target2D[0].toUpperCase()}`, null, "shio");
    add("ES", "regime", `ES-R-${target2D[0].toUpperCase()}`, null, "shio");
    return profiles;
  }

  if (isJumlah2DMode(scanMode)) {
    add("EJ", "local", `EJ-L-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("EJ", "cross", `EJ-X-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("EJ", "regime", `EJ-R-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    add("EJ", "area", `EJ-A-${target2D[0].toUpperCase()}`, null, "jumlah2d");
    return profiles;
  }

  const anchors = scanMode === "posisi" || scanMode === "off_posisi" ? [targetPos] : area;
  const areaCode = is3DMode(scanMode) ? `3${target3D[0].toUpperCase()}` : target2D[0].toUpperCase();
  for (const anchor of anchors) {
    add("EL", "local", `EL-${anchor}`, anchor, "position");
    add("EX", "cross", `EX-${anchor}`, anchor, "position");
    add("ER", "regime", `ER-${anchor}`, anchor, "position");
    if (area.length) add("EA", "area", `EA-${areaCode}-${anchor}`, anchor, "position");
  }
  return profiles;
}
