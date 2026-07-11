import {
  clamp,
  isShioMode,
  scanModeOrDefault,
  target2DOrDefault,
  target3DOrDefault,
} from "../engine/helpers";
import type { Draw, Kolom, Posisi, ScanMode, Target2D, Target3D } from "../engine/types";
import {
  buildEchoBacktestRows,
  composeEchoAudit,
  echoColumnsForMode,
  echoDeretForMode,
  evaluateFrozenRows,
  evaluateNestedWalkForward,
  fitEchoColumns,
  splitEchoRows,
  type EchoColumnFit,
  type EchoPhaseAudit,
  type EchoRowSplit,
} from "./audit";
import {
  buildEchoEvaluationPlan,
  ECHO_MIN_TOTAL_DATA,
  ECHO_MIN_NEIGHBORS,
  ECHO_STATE_WINDOW,
} from "./config";
import {
  buildCycleBacktestRows,
  buildCycleProfiles,
  predictCycleAt,
} from "./cycle";
import { buildCandidateDiagnostics, buildHoldoutDiagnostics } from "./diagnostics";
import { buildEchoEnsembleCandidate } from "./ensemble";
import {
  buildPairBacktestRows,
  buildPairProfiles,
  predictPairAt,
} from "./pair";
import { predictEchoAt, type EchoPrediction } from "./pattern";
import { buildEchoProfiles } from "./profiles";
import {
  familyGroupOf,
  selectFamilyRepresentatives,
  type EchoSelectableCandidate,
} from "./selection";
import {
  buildTransitionBacktestRows,
  buildTransitionProfiles,
  predictTransitionAt,
} from "./transition";
import type {
  EchoConfig,
  EchoFamily,
  EchoFamilyContribution,
  EchoItem,
  EchoProfile,
  EchoResult,
  EchoSelectionKind,
  EchoStrength,
} from "./types";

interface EchoCandidate extends EchoSelectableCandidate {
  selectionKind: EchoSelectionKind;
  contributors: EchoFamilyContribution[];
  frozenColumns?: Kolom[];
  liveDeret?: number[];
}

function normalizedReliability(rate: number, baseline: number): number {
  const lift = rate - baseline;
  if (lift >= 0) return Math.min(1, 0.5 + 0.5 * (lift / Math.max(1, 100 - baseline)));
  return Math.max(0, 0.5 + 0.5 * (lift / Math.max(1, baseline)));
}

function scoreCandidate(candidate: Pick<EchoCandidate, "discoveryFit" | "validation" | "live">): number {
  const discoveryReliability =
    0.65 * normalizedReliability(candidate.discoveryFit.weightedAccuracy, candidate.discoveryFit.baselineRate) +
    0.35 * (candidate.discoveryFit.weightedAccuracy / 100);
  const walkForwardReliability =
    0.75 * normalizedReliability(candidate.validation.rate, candidate.validation.baselineRate) +
    0.25 * (candidate.validation.rate / 100);
  const stability = (
    candidate.live.quality.ensembleStability * 0.55 +
    candidate.discoveryFit.windowStability * 0.45
  ) / 100;

  let score = (
    0.24 * discoveryReliability +
    0.42 * walkForwardReliability +
    0.16 * (candidate.live.confidence / 100) +
    0.12 * stability +
    0.06 * Math.min(1, candidate.discoveryFit.efficiency)
  ) * 100;

  if (candidate.validation.lift < 0) score -= 12;
  if (candidate.discoveryFit.lift < 0) score -= 6;
  if (candidate.validation.rate + 15 < candidate.discoveryFit.weightedAccuracy) score -= 8;
  if (candidate.live.quality.effectiveNeighbors < ECHO_MIN_NEIGHBORS - 1) score -= 8;
  if (candidate.live.confidence < 50) score -= 6;
  if (candidate.discoveryFit.windowStability < 60) score -= 5;
  if (candidate.validation.longestMissStreak > 3) score -= 5;

  return Number(Math.max(0, score).toFixed(2));
}

function verifiedScore(candidate: EchoCandidate, holdout: EchoPhaseAudit): number {
  const holdoutReliability =
    0.75 * normalizedReliability(holdout.rate, holdout.baselineRate) +
    0.25 * (holdout.rate / 100);
  const validationDrop = Math.max(0, candidate.validation.rate - holdout.rate);

  let score = candidate.score * 0.7 + holdoutReliability * 30;
  if (holdout.lift < 0) score -= Math.min(15, Math.abs(holdout.lift) * 0.35);
  if (validationDrop > 20) score -= Math.min(12, (validationDrop - 20) * 0.4);
  if (holdout.longestMissStreak > 3) score -= 5;

  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
}

function strengthOf(candidate: EchoCandidate, holdout: EchoPhaseAudit, finalScore: number): EchoStrength {
  const validationDrop = candidate.validation.rate - holdout.rate;

  if (
    finalScore >= 72 &&
    candidate.discoveryFit.lift >= 5 &&
    candidate.validation.lift >= 8 &&
    holdout.lift >= 5 &&
    validationDrop <= 20 &&
    holdout.longestMissStreak <= 3 &&
    candidate.live.confidence >= 60
  ) return "KUAT";

  if (
    finalScore >= 58 &&
    candidate.discoveryFit.lift >= 0 &&
    candidate.validation.lift >= 0 &&
    holdout.lift >= 0 &&
    validationDrop <= 30 &&
    candidate.live.confidence >= 50
  ) return "CUKUP";

  return "PANTAU";
}

function overlapRatio(left: number[], right: number[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let common = 0;
  for (const digit of rightSet) if (leftSet.has(digit)) common += 1;
  return common / Math.max(1, Math.min(leftSet.size, rightSet.size));
}

function consensusFor(top: EchoCandidate, representatives: EchoCandidate[]): {
  familyAgreement: number;
  consensusFamilies: EchoFamily[];
} {
  const availableFamilies = new Set(representatives.map((candidate) => candidate.profile.family));
  const support = new Set<EchoFamily>();

  if (top.selectionKind === "single") support.add(top.profile.family);
  for (const candidate of representatives) {
    if (top.selectionKind === "single" && candidate.profile.family === top.profile.family) continue;
    if (overlapRatio(top.liveDigits, candidate.liveDigits) >= 0.5) support.add(candidate.profile.family);
  }

  return {
    familyAgreement: availableFamilies.size
      ? Number(((support.size / availableFamilies.size) * 100).toFixed(1))
      : 0,
    consensusFamilies: [...support].sort(),
  };
}

function digitsForColumns(columns: Kolom[], deret: number[], scanMode: ScanMode): number[] {
  const sourceColumns = echoColumnsForMode(scanMode);
  return columns
    .map((column) => deret[sourceColumns.indexOf(column)])
    .filter((digit): digit is number => Number.isFinite(digit));
}

function liveDigits(fit: EchoColumnFit, live: EchoPrediction, scanMode: ScanMode): number[] {
  return digitsForColumns(fit.columns, echoDeretForMode(live.patokan, scanMode), scanMode);
}

function inactiveColumns(active: Kolom[], scanMode: ScanMode): Kolom[] {
  const selected = new Set(active);
  return echoColumnsForMode(scanMode).filter((column) => !selected.has(column)) as Kolom[];
}

function inactiveDigits(active: Kolom[], deret: number[], scanMode: ScanMode): number[] {
  return digitsForColumns(inactiveColumns(active, scanMode), deret, scanMode);
}

function rankCandidates(left: EchoCandidate, right: EchoCandidate): number {
  return right.score - left.score ||
    right.validation.lift - left.validation.lift ||
    right.validation.rate - left.validation.rate ||
    right.discoveryFit.lift - left.discoveryFit.lift ||
    right.live.confidence - left.live.confidence ||
    left.profile.formula.localeCompare(right.profile.formula);
}

function resultConfig(
  targetPos: Posisi,
  target2D: Target2D,
  target3D: Target3D,
  digitCount: number,
  scanMode: ScanMode,
  plan: ReturnType<typeof buildEchoEvaluationPlan>,
  sourceDataSize: number,
): EchoResult["config"] {
  return {
    targetPos,
    target2D,
    target3D,
    digitCount,
    scanMode,
    discoveryWindows: plan.discoveryWindows.map((window) => window.size),
    validationSize: plan.validationSize,
    holdoutSize: plan.holdoutSize,
    evaluationRows: plan.totalRows,
    sourceDataSize,
    nestedWalkForward: true,
    familyRepresentativeSelection: true,
    ensembleFrozenBeforeHoldout: true,
    finalHoldoutUsedForSelection: false,
    finalHoldoutUsedAsReleaseGate: true,
  };
}

function backtestRowsForProfile(
  draws: Draw[],
  profile: EchoProfile,
  scanMode: ScanMode,
  targetPos: Posisi,
  target2D: Target2D,
  target3D: Target3D,
  plan: ReturnType<typeof buildEchoEvaluationPlan>,
): ReturnType<typeof buildEchoBacktestRows> {
  if (profile.family === "ET") {
    return buildTransitionBacktestRows(draws, profile, scanMode, targetPos, target2D, target3D, plan);
  }
  if (profile.family === "EC") {
    return buildCycleBacktestRows(draws, profile, scanMode, targetPos, target2D, target3D, plan);
  }
  if (profile.family === "EP") {
    return buildPairBacktestRows(draws, profile, scanMode, targetPos, target2D, target3D, plan);
  }
  return buildEchoBacktestRows(draws, profile, scanMode, targetPos, target2D, target3D, plan);
}

function livePredictionForProfile(
  draws: Draw[],
  profile: EchoProfile,
  scanMode: ScanMode,
  target2D: Target2D,
  plan: ReturnType<typeof buildEchoEvaluationPlan>,
): EchoPrediction | null {
  if (profile.family === "ET") {
    return predictTransitionAt(draws, draws.length, profile, scanMode, target2D, plan);
  }
  if (profile.family === "EC") {
    return predictCycleAt(draws, draws.length, profile, scanMode, target2D, plan);
  }
  if (profile.family === "EP") {
    return predictPairAt(draws, draws.length, profile, plan);
  }
  return predictEchoAt(draws, draws.length, profile, scanMode, target2D, plan);
}

function singleContribution(candidate: EchoCandidate): EchoFamilyContribution[] {
  return [{
    group: familyGroupOf(candidate.profile.family),
    family: candidate.profile.family,
    formula: candidate.profile.formula,
    weight: 100,
    digits: [...candidate.liveDigits],
    validationLift: candidate.validation.lift,
  }];
}

export function runEcho(draws: Draw[], config: EchoConfig): EchoResult {
  if (draws.length < ECHO_MIN_TOTAL_DATA) {
    throw new Error(`Data belum cukup. Echo Engine membutuhkan minimal ${ECHO_MIN_TOTAL_DATA} result.`);
  }

  const plan = buildEchoEvaluationPlan(draws.length);
  const scanMode = scanModeOrDefault(config.scanMode);
  const targetPos: Posisi = config.targetPos ?? "K";
  const target2D: Target2D = target2DOrDefault(config.target2D);
  const target3D: Target3D = target3DOrDefault(config.target3D);
  const digitCount = clamp(config.digitCount, 4, 1, isShioMode(scanMode) ? 12 : 9);
  const profiles = [
    ...buildEchoProfiles(scanMode, targetPos, target2D, target3D),
    ...buildTransitionProfiles(scanMode, targetPos, target2D, target3D),
    ...buildCycleProfiles(scanMode, targetPos, target2D, target3D),
    ...buildPairProfiles(scanMode, target2D, target3D),
  ];
  const candidates: EchoCandidate[] = [];

  for (const profile of profiles) {
    const rows = backtestRowsForProfile(draws, profile, scanMode, targetPos, target2D, target3D, plan);
    if (rows.length < plan.totalRows) continue;
    const split: EchoRowSplit = splitEchoRows(rows, plan);
    const discoveryFit = fitEchoColumns(split.discovery, digitCount, scanMode, plan.discoveryWindows);
    if (!discoveryFit) continue;

    const validation = evaluateNestedWalkForward(
      split.discovery,
      split.validation,
      digitCount,
      scanMode,
      plan.discoveryWindows,
    );
    const productionFit = fitEchoColumns(rows, digitCount, scanMode, plan.discoveryWindows);
    const live = livePredictionForProfile(draws, profile, scanMode, target2D, plan);
    if (!productionFit || !live) continue;

    const partial: EchoCandidate = {
      profile,
      rows,
      split,
      discoveryFit,
      validation,
      productionFit,
      live,
      liveDigits: liveDigits(productionFit, live, scanMode),
      score: 0,
      selectionKind: "single",
      contributors: [],
    };
    partial.score = scoreCandidate(partial);
    partial.contributors = singleContribution(partial);
    candidates.push(partial);
  }

  const representatives = selectFamilyRepresentatives(candidates);
  const ensemble = buildEchoEnsembleCandidate(representatives, digitCount, scanMode, plan);
  const modelCandidates: EchoCandidate[] = [...representatives];
  if (ensemble) {
    ensemble.score = scoreCandidate(ensemble as EchoCandidate);
    modelCandidates.push(ensemble as EchoCandidate);
  }
  const ranked = [...modelCandidates].sort(rankCandidates);
  const top = ranked[0] ?? null;
  const candidateDiagnostics = buildCandidateDiagnostics(top);
  const configResult = resultConfig(targetPos, target2D, target3D, digitCount, scanMode, plan, draws.length);

  if (!top || candidateDiagnostics.length > 0) {
    return {
      config: configResult,
      totalProfiles: profiles.length,
      totalQualified: candidates.length,
      totalFamilies: representatives.length,
      message: "Belum ada keluarga metode yang konsisten pada evaluasi awal dan uji berurutan. Rekomendasi tidak ditampilkan.",
      diagnostics: candidateDiagnostics,
      items: [],
    };
  }

  let preHoldoutColumns = top.frozenColumns;
  if (!preHoldoutColumns) {
    const preHoldoutFit = fitEchoColumns(
      [...top.split.discovery, ...top.split.validation],
      digitCount,
      scanMode,
      plan.discoveryWindows,
    );
    if (!preHoldoutFit) throw new Error("Gagal membekukan model sebelum final holdout.");
    preHoldoutColumns = preHoldoutFit.columns;
  }

  const holdout = evaluateFrozenRows(
    top.split.holdout,
    preHoldoutColumns,
    digitCount,
    scanMode,
    "holdout",
  );
  const finalScore = verifiedScore(top, holdout);
  const holdoutDiagnostics = buildHoldoutDiagnostics(top, holdout, finalScore);

  if (holdoutDiagnostics.length > 0) {
    return {
      config: configResult,
      totalProfiles: profiles.length,
      totalQualified: candidates.length,
      totalFamilies: representatives.length,
      message: `${top.selectionKind === "ensemble" ? "Ensemble keluarga" : "Keluarga metode terbaik"} lolos evaluasi awal, tetapi gagal pada verifikasi akhir. Rekomendasi tidak ditampilkan agar hasil yang lemah tidak dipaksakan.`,
      diagnostics: holdoutDiagnostics,
      items: [],
    };
  }

  const audit = composeEchoAudit(top.discoveryFit, top.validation, holdout);
  const consensus = consensusFor(top, representatives);
  const activeColumns = top.frozenColumns ?? top.productionFit.columns;
  const inactive = inactiveColumns(activeColumns, scanMode);
  const deretLive = top.liveDeret ?? echoDeretForMode(top.live.patokan, scanMode);
  const angkaHidup = digitsForColumns(activeColumns, deretLive, scanMode);
  const item: EchoItem = {
    family: top.profile.family,
    familyGroup: familyGroupOf(top.profile.family),
    selectionKind: top.selectionKind,
    formula: top.profile.formula,
    anchorPos: top.profile.anchorPos,
    targetPos,
    target2D,
    target3D,
    scanMode,
    angkaHidup,
    angkaMati: inactiveDigits(activeColumns, deretLive, scanMode),
    kolomHidup: activeColumns,
    kolomMati: inactive,
    activeColumns: activeColumns.join(""),
    score: finalScore,
    strength: strengthOf(top, holdout, finalScore),
    confidence: top.live.confidence,
    confidenceLevel: top.live.confidenceLevel,
    familyAgreement: consensus.familyAgreement,
    consensusFamilies: consensus.consensusFamilies,
    contributors: top.contributors.length ? top.contributors : singleContribution(top),
    audit,
    echo: top.live.quality,
    result: {
      latestDraw: draws[draws.length - 1],
      patokan: top.live.patokan,
      deretLive,
      rows: [
        ...top.discoveryFit.rows,
        ...top.validation.rows,
        ...holdout.rows,
      ],
      neighbors: top.live.neighbors,
    },
  };

  return {
    config: configResult,
    totalProfiles: profiles.length,
    totalQualified: candidates.length,
    totalFamilies: representatives.length,
    message: `${top.selectionKind === "ensemble" ? "Ensemble keluarga" : "Keluarga metode terbaik"} lolos evaluasi awal, uji berurutan, dan verifikasi akhir.`,
    diagnostics: [],
    items: [item],
  };
}

export const ECHO_INTERNAL_CONFIG = {
  stateWindow: ECHO_STATE_WINDOW,
  minimumTotalData: ECHO_MIN_TOTAL_DATA,
  minimumNeighbors: ECHO_MIN_NEIGHBORS,
  nestedWalkForward: true,
  familyRepresentativeSelection: true,
  ensembleFrozenBeforeHoldout: true,
  finalHoldoutUsedForSelection: false,
  finalHoldoutUsedAsReleaseGate: true,
};
