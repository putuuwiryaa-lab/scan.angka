import type { ScanMode } from "../engine/types";
import type { EchoColumnFit, EchoPhaseAudit } from "./audit";
import type { EchoPrediction } from "./pattern";
import type { EchoDiagnostic, EchoReleaseEvidence } from "./types";

export interface EchoGateProfile {
  minimumScore: number;
  minimumConfidence: number;
  minimumEffectiveNeighbors: number;
  minimumDiscoveryLift: number;
  minimumValidationLift: number;
  minimumValidationRows: number;
  minimumHoldoutRows: number;
  maximumValidationDrop: number;
  softHoldoutFloor: number;
}

interface DiagnosticCandidate {
  score: number;
  discoveryFit: Pick<EchoColumnFit, "lift">;
  validation: Pick<EchoPhaseAudit, "hit" | "lift" | "rate" | "baselineRate" | "total">;
  live: Pick<EchoPrediction, "confidence" | "quality">;
}

function baseGate(scanMode: ScanMode): EchoGateProfile {
  if (scanMode === "ai_2d_belakang" || scanMode === "bbfs_2d_belakang") {
    return {
      minimumScore: 56,
      minimumConfidence: 48,
      minimumEffectiveNeighbors: 5,
      minimumDiscoveryLift: 0,
      minimumValidationLift: 0,
      minimumValidationRows: 6,
      minimumHoldoutRows: 6,
      maximumValidationDrop: 30,
      softHoldoutFloor: -3,
    };
  }

  if (scanMode === "posisi") {
    return {
      minimumScore: 57,
      minimumConfidence: 49,
      minimumEffectiveNeighbors: 5.2,
      minimumDiscoveryLift: 0,
      minimumValidationLift: 0,
      minimumValidationRows: 6,
      minimumHoldoutRows: 6,
      maximumValidationDrop: 28,
      softHoldoutFloor: -2,
    };
  }

  if (scanMode === "ai_3d" || scanMode === "bbfs_3d") {
    return {
      minimumScore: 58,
      minimumConfidence: 50,
      minimumEffectiveNeighbors: 5.2,
      minimumDiscoveryLift: 0,
      minimumValidationLift: 0,
      minimumValidationRows: 6,
      minimumHoldoutRows: 6,
      maximumValidationDrop: 28,
      softHoldoutFloor: -2,
    };
  }

  if (scanMode === "shio") {
    return {
      minimumScore: 60,
      minimumConfidence: 55,
      minimumEffectiveNeighbors: 5.5,
      minimumDiscoveryLift: 1,
      minimumValidationLift: 1,
      minimumValidationRows: 6,
      minimumHoldoutRows: 6,
      maximumValidationDrop: 25,
      softHoldoutFloor: 0,
    };
  }

  if (scanMode.startsWith("off_")) {
    return {
      minimumScore: 59,
      minimumConfidence: 52,
      minimumEffectiveNeighbors: 5.5,
      minimumDiscoveryLift: 0,
      minimumValidationLift: 0,
      minimumValidationRows: 6,
      minimumHoldoutRows: 6,
      maximumValidationDrop: 25,
      softHoldoutFloor: 0,
    };
  }

  return {
    minimumScore: 58,
    minimumConfidence: 52,
    minimumEffectiveNeighbors: 5.5,
    minimumDiscoveryLift: 0,
    minimumValidationLift: 0,
    minimumValidationRows: 6,
    minimumHoldoutRows: 6,
    maximumValidationDrop: 28,
    softHoldoutFloor: 0,
  };
}

export function echoGateFor(scanMode: ScanMode, digitCount: number): EchoGateProfile {
  const gate = baseGate(scanMode);
  const broadSelectionPenalty = digitCount >= 8 ? 2 : digitCount >= 6 ? 1 : 0;
  const softHoldoutFloor = digitCount <= 5 ? gate.softHoldoutFloor : 0;
  return {
    ...gate,
    minimumScore: gate.minimumScore + broadSelectionPenalty,
    softHoldoutFloor,
  };
}

function metric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function buildCandidateDiagnostics(
  candidate: DiagnosticCandidate | null,
  scanMode: ScanMode,
  digitCount: number,
): EchoDiagnostic[] {
  if (!candidate) {
    return [{
      code: "NO_QUALIFIED_PROFILE",
      phase: "candidate",
      label: "Tidak ada profile lengkap",
      detail: "Semua profile berhenti sebelum menghasilkan evaluasi discovery, validation, dan prediksi live yang lengkap.",
    }];
  }

  const gate = echoGateFor(scanMode, digitCount);
  const diagnostics: EchoDiagnostic[] = [];

  if (candidate.score < gate.minimumScore) {
    diagnostics.push({
      code: "SCORE_BELOW_MINIMUM",
      phase: "candidate",
      label: "Skor evaluasi belum cukup",
      actual: candidate.score,
      required: gate.minimumScore,
      detail: `Skor ${metric(candidate.score)}; minimum mode ini ${gate.minimumScore}.`,
    });
  }

  if (candidate.discoveryFit.lift < gate.minimumDiscoveryLift) {
    diagnostics.push({
      code: "NEGATIVE_DISCOVERY_LIFT",
      phase: "candidate",
      label: "Discovery belum mengungguli baseline",
      actual: candidate.discoveryFit.lift,
      required: gate.minimumDiscoveryLift,
      detail: `Lift discovery ${metric(candidate.discoveryFit.lift)}%; minimum mode ini ${metric(gate.minimumDiscoveryLift)}%.`,
    });
  }

  if (
    candidate.validation.lift < gate.minimumValidationLift ||
    candidate.validation.rate < candidate.validation.baselineRate
  ) {
    diagnostics.push({
      code: "NEGATIVE_VALIDATION_LIFT",
      phase: "candidate",
      label: "Walk-forward belum mengungguli baseline",
      actual: candidate.validation.lift,
      required: gate.minimumValidationLift,
      detail: `Lift walk-forward ${metric(candidate.validation.lift)}% dari ${candidate.validation.total} pengujian; minimum mode ini ${metric(gate.minimumValidationLift)}%.`,
    });
  }

  if (candidate.live.confidence < gate.minimumConfidence) {
    diagnostics.push({
      code: "LOW_CONFIDENCE",
      phase: "candidate",
      label: "Keyakinan live rendah",
      actual: candidate.live.confidence,
      required: gate.minimumConfidence,
      detail: `Confidence ${metric(candidate.live.confidence)}; minimum mode ini ${gate.minimumConfidence}.`,
    });
  }

  if (candidate.live.quality.effectiveNeighbors < gate.minimumEffectiveNeighbors) {
    diagnostics.push({
      code: "LOW_EFFECTIVE_SAMPLE",
      phase: "candidate",
      label: "Sampel efektif terlalu sedikit",
      actual: candidate.live.quality.effectiveNeighbors,
      required: gate.minimumEffectiveNeighbors,
      detail: `Effective sample ${metric(candidate.live.quality.effectiveNeighbors)}; minimum mode ini ${metric(gate.minimumEffectiveNeighbors)}.`,
    });
  }

  if (candidate.validation.total < gate.minimumValidationRows) {
    diagnostics.push({
      code: "INSUFFICIENT_VALIDATION",
      phase: "candidate",
      label: "Sampel walk-forward belum cukup",
      actual: candidate.validation.total,
      required: gate.minimumValidationRows,
      detail: `Tersedia ${candidate.validation.total} pengujian; minimum ${gate.minimumValidationRows}.`,
    });
  }

  return diagnostics;
}

function releaseEvidence(
  candidate: DiagnosticCandidate,
  holdout: EchoPhaseAudit,
  gate: EchoGateProfile,
): EchoReleaseEvidence {
  const total = candidate.validation.total + holdout.total;
  const hits = candidate.validation.hit + holdout.hit;
  const baselineRate = total > 0
    ? (
      candidate.validation.baselineRate * candidate.validation.total +
      holdout.baselineRate * holdout.total
    ) / total
    : 0;
  const priorStrength = 6;
  const posteriorRate = total > 0
    ? ((hits + (baselineRate / 100) * priorStrength) / (total + priorStrength)) * 100
    : 0;
  const evidenceLift = posteriorRate - baselineRate;
  const softAccepted =
    gate.softHoldoutFloor < 0 &&
    holdout.lift < 0 &&
    holdout.lift >= gate.softHoldoutFloor &&
    candidate.validation.lift >= 5 &&
    evidenceLift >= 1;

  return {
    holdoutFloor: gate.softHoldoutFloor,
    combinedRate: Number(posteriorRate.toFixed(1)),
    combinedBaselineRate: Number(baselineRate.toFixed(1)),
    combinedLift: Number(evidenceLift.toFixed(1)),
    softAccepted,
  };
}

export function evaluateHoldoutRelease(
  candidate: DiagnosticCandidate,
  holdout: EchoPhaseAudit,
  finalScore: number,
  scanMode: ScanMode,
  digitCount: number,
): { diagnostics: EchoDiagnostic[]; evidence: EchoReleaseEvidence } {
  const gate = echoGateFor(scanMode, digitCount);
  const evidence = releaseEvidence(candidate, holdout, gate);
  const diagnostics: EchoDiagnostic[] = [];
  const expectedHits = Math.ceil((holdout.baselineRate / 100) * holdout.total);
  const minimumHits = Math.max(Math.ceil(holdout.total * 0.25), expectedHits);
  const allowedHits = evidence.softAccepted ? Math.max(0, minimumHits - 1) : minimumHits;
  const maximumMissStreak = Math.max(3, Math.floor(holdout.total / 3));
  const validationDrop = candidate.validation.rate - holdout.rate;

  if (holdout.total < gate.minimumHoldoutRows) {
    diagnostics.push({
      code: "INSUFFICIENT_HOLDOUT",
      phase: "holdout",
      label: "Sampel verifikasi akhir belum cukup",
      actual: holdout.total,
      required: gate.minimumHoldoutRows,
      detail: `Tersedia ${holdout.total} pengujian; minimum ${gate.minimumHoldoutRows}.`,
    });
  }

  if (holdout.hit < allowedHits) {
    diagnostics.push({
      code: "HOLDOUT_HIT_BELOW_BASELINE",
      phase: "holdout",
      label: "Hit verifikasi di bawah kebutuhan",
      actual: holdout.hit,
      required: allowedHits,
      detail: `Hit ${holdout.hit}/${holdout.total}; minimum ${allowedHits}/${holdout.total} berdasarkan baseline ${metric(holdout.baselineRate)}%.`,
    });
  }

  if (holdout.lift < 0 && !evidence.softAccepted) {
    diagnostics.push({
      code: "NEGATIVE_HOLDOUT_LIFT",
      phase: "holdout",
      label: "Verifikasi akhir di bawah baseline",
      actual: holdout.lift,
      required: gate.softHoldoutFloor,
      detail: `Lift holdout ${metric(holdout.lift)}%. Bukti gabungan ${metric(evidence.combinedLift)}%; belum cukup untuk toleransi sampel pendek.`,
    });
  }

  if (validationDrop > gate.maximumValidationDrop) {
    diagnostics.push({
      code: "EXCESSIVE_VALIDATION_DROP",
      phase: "holdout",
      label: "Performa turun terlalu tajam",
      actual: validationDrop,
      required: gate.maximumValidationDrop,
      detail: `Penurunan walk-forward ke holdout ${metric(validationDrop)} poin; maksimum mode ini ${gate.maximumValidationDrop}.`,
    });
  }

  if (holdout.longestMissStreak > maximumMissStreak) {
    diagnostics.push({
      code: "HOLDOUT_MISS_STREAK",
      phase: "holdout",
      label: "Rentetan miss terlalu panjang",
      actual: holdout.longestMissStreak,
      required: maximumMissStreak,
      detail: `Longest miss streak ${holdout.longestMissStreak}; maksimum ${maximumMissStreak}.`,
    });
  }

  const minimumFinalScore = evidence.softAccepted ? gate.minimumScore + 2 : gate.minimumScore;
  if (finalScore < minimumFinalScore) {
    diagnostics.push({
      code: "LOW_FINAL_SCORE",
      phase: "holdout",
      label: "Skor akhir belum cukup",
      actual: finalScore,
      required: minimumFinalScore,
      detail: `Skor akhir ${metric(finalScore)}; minimum release ${minimumFinalScore}.`,
    });
  }

  return { diagnostics, evidence };
}

export function buildHoldoutDiagnostics(
  candidate: DiagnosticCandidate,
  holdout: EchoPhaseAudit,
  finalScore: number,
  scanMode: ScanMode,
  digitCount: number,
): EchoDiagnostic[] {
  return evaluateHoldoutRelease(candidate, holdout, finalScore, scanMode, digitCount).diagnostics;
}
