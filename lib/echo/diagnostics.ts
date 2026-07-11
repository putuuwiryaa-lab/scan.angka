import type { EchoColumnFit, EchoPhaseAudit } from "./audit";
import type { EchoPrediction } from "./pattern";
import type { EchoDiagnostic } from "./types";

export const ECHO_GATE = {
  minimumScore: 58,
  minimumConfidence: 50,
  minimumEffectiveNeighbors: 5.5,
  minimumValidationRows: 6,
  minimumHoldoutRows: 6,
  maximumValidationDrop: 30,
} as const;

interface DiagnosticCandidate {
  score: number;
  discoveryFit: Pick<EchoColumnFit, "lift">;
  validation: Pick<EchoPhaseAudit, "lift" | "rate" | "baselineRate" | "total">;
  live: Pick<EchoPrediction, "confidence" | "quality">;
}

function metric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function buildCandidateDiagnostics(candidate: DiagnosticCandidate | null): EchoDiagnostic[] {
  if (!candidate) {
    return [{
      code: "NO_QUALIFIED_PROFILE",
      phase: "candidate",
      label: "Tidak ada profile lengkap",
      detail: "Semua profile berhenti sebelum menghasilkan evaluasi discovery, validation, dan prediksi live yang lengkap.",
    }];
  }

  const diagnostics: EchoDiagnostic[] = [];

  if (candidate.score < ECHO_GATE.minimumScore) {
    diagnostics.push({
      code: "SCORE_BELOW_MINIMUM",
      phase: "candidate",
      label: "Skor evaluasi belum cukup",
      actual: candidate.score,
      required: ECHO_GATE.minimumScore,
      detail: `Skor ${metric(candidate.score)}; minimum ${ECHO_GATE.minimumScore}.`,
    });
  }

  if (candidate.discoveryFit.lift < 0) {
    diagnostics.push({
      code: "NEGATIVE_DISCOVERY_LIFT",
      phase: "candidate",
      label: "Discovery di bawah baseline",
      actual: candidate.discoveryFit.lift,
      required: 0,
      detail: `Lift discovery ${metric(candidate.discoveryFit.lift)}%; wajib minimal 0%.`,
    });
  }

  if (candidate.validation.lift < 0 || candidate.validation.rate < candidate.validation.baselineRate) {
    diagnostics.push({
      code: "NEGATIVE_VALIDATION_LIFT",
      phase: "candidate",
      label: "Walk-forward di bawah baseline",
      actual: candidate.validation.lift,
      required: 0,
      detail: `Lift walk-forward ${metric(candidate.validation.lift)}% dari ${candidate.validation.total} pengujian; wajib minimal 0%.`,
    });
  }

  if (candidate.live.confidence < ECHO_GATE.minimumConfidence) {
    diagnostics.push({
      code: "LOW_CONFIDENCE",
      phase: "candidate",
      label: "Keyakinan live rendah",
      actual: candidate.live.confidence,
      required: ECHO_GATE.minimumConfidence,
      detail: `Confidence ${metric(candidate.live.confidence)}; minimum ${ECHO_GATE.minimumConfidence}.`,
    });
  }

  if (candidate.live.quality.effectiveNeighbors < ECHO_GATE.minimumEffectiveNeighbors) {
    diagnostics.push({
      code: "LOW_EFFECTIVE_SAMPLE",
      phase: "candidate",
      label: "Neighbor efektif terlalu sedikit",
      actual: candidate.live.quality.effectiveNeighbors,
      required: ECHO_GATE.minimumEffectiveNeighbors,
      detail: `Effective neighbors ${metric(candidate.live.quality.effectiveNeighbors)}; minimum ${ECHO_GATE.minimumEffectiveNeighbors}.`,
    });
  }

  if (candidate.validation.total < ECHO_GATE.minimumValidationRows) {
    diagnostics.push({
      code: "INSUFFICIENT_VALIDATION",
      phase: "candidate",
      label: "Sampel walk-forward belum cukup",
      actual: candidate.validation.total,
      required: ECHO_GATE.minimumValidationRows,
      detail: `Tersedia ${candidate.validation.total} pengujian; minimum ${ECHO_GATE.minimumValidationRows}.`,
    });
  }

  return diagnostics;
}

export function buildHoldoutDiagnostics(
  candidate: DiagnosticCandidate,
  holdout: EchoPhaseAudit,
  finalScore: number,
): EchoDiagnostic[] {
  const diagnostics: EchoDiagnostic[] = [];
  const expectedHits = Math.ceil((holdout.baselineRate / 100) * holdout.total);
  const minimumHits = Math.max(Math.ceil(holdout.total * 0.25), expectedHits);
  const maximumMissStreak = Math.max(3, Math.floor(holdout.total / 3));
  const validationDrop = candidate.validation.rate - holdout.rate;

  if (holdout.total < ECHO_GATE.minimumHoldoutRows) {
    diagnostics.push({
      code: "INSUFFICIENT_HOLDOUT",
      phase: "holdout",
      label: "Sampel verifikasi akhir belum cukup",
      actual: holdout.total,
      required: ECHO_GATE.minimumHoldoutRows,
      detail: `Tersedia ${holdout.total} pengujian; minimum ${ECHO_GATE.minimumHoldoutRows}.`,
    });
  }

  if (holdout.hit < minimumHits) {
    diagnostics.push({
      code: "HOLDOUT_HIT_BELOW_BASELINE",
      phase: "holdout",
      label: "Hit verifikasi di bawah kebutuhan",
      actual: holdout.hit,
      required: minimumHits,
      detail: `Hit ${holdout.hit}/${holdout.total}; minimum ${minimumHits}/${holdout.total} berdasarkan baseline ${metric(holdout.baselineRate)}%.`,
    });
  }

  if (holdout.lift < 0) {
    diagnostics.push({
      code: "NEGATIVE_HOLDOUT_LIFT",
      phase: "holdout",
      label: "Verifikasi akhir di bawah baseline",
      actual: holdout.lift,
      required: 0,
      detail: `Lift holdout ${metric(holdout.lift)}%; wajib minimal 0%.`,
    });
  }

  if (validationDrop > ECHO_GATE.maximumValidationDrop) {
    diagnostics.push({
      code: "EXCESSIVE_VALIDATION_DROP",
      phase: "holdout",
      label: "Performa turun terlalu tajam",
      actual: validationDrop,
      required: ECHO_GATE.maximumValidationDrop,
      detail: `Penurunan walk-forward ke holdout ${metric(validationDrop)} poin; maksimum ${ECHO_GATE.maximumValidationDrop}.`,
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

  if (finalScore < ECHO_GATE.minimumScore) {
    diagnostics.push({
      code: "LOW_FINAL_SCORE",
      phase: "holdout",
      label: "Skor akhir belum cukup",
      actual: finalScore,
      required: ECHO_GATE.minimumScore,
      detail: `Skor akhir ${metric(finalScore)}; minimum ${ECHO_GATE.minimumScore}.`,
    });
  }

  return diagnostics;
}
