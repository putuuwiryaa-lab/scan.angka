import type { EchoColumnFit, EchoPhaseAudit } from "./audit";
import type { EchoPrediction } from "./pattern";
import type { EchoDiagnostic, EchoReleaseEvidence } from "./types";

export interface EchoEvidenceProfile {
  baselineRate: number;
  rows: number;
  standardError: number;
  oneHitStep: number;
  minimumLift: number;
  minimumHits: number;
}

export interface EchoGateProfile {
  minimumScore: number;
  minimumConfidence: number;
  minimumEffectiveNeighbors: number;
  minimumDiscoveryLift: number;
  minimumValidationLift: number;
  minimumValidationHits: number;
  minimumValidationRows: number;
  minimumHoldoutRows: number;
  maximumValidationDrop: number;
  softHoldoutFloor: number;
  baselineRate: number;
  walkForwardRows: number;
  standardError: number;
  oneHitStep: number;
}

interface DiagnosticCandidate {
  score: number;
  discoveryFit: Pick<EchoColumnFit, "lift" | "baselineRate" | "total">;
  validation: Pick<EchoPhaseAudit, "hit" | "lift" | "rate" | "baselineRate" | "total">;
  live: Pick<EchoPrediction, "confidence" | "quality">;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value: number): number {
  return Number(value.toFixed(1));
}

export function echoEvidenceFor(
  baselineRate: number,
  rows: number,
  uncertaintyFraction = 0.25,
): EchoEvidenceProfile {
  const safeRows = Math.max(1, Math.trunc(rows));
  const safeBaseline = clamp(Number.isFinite(baselineRate) ? baselineRate : 0, 0.1, 99.9);
  const probability = safeBaseline / 100;
  const standardError = Math.sqrt((probability * (1 - probability)) / safeRows) * 100;
  const oneHitStep = 100 / safeRows;
  const minimumLift = clamp(standardError * uncertaintyFraction, 0, 8);
  const minimumHits = Math.min(
    safeRows,
    Math.ceil((((safeBaseline + minimumLift) / 100) * safeRows) - 1e-9),
  );

  return {
    baselineRate: rounded(safeBaseline),
    rows: safeRows,
    standardError: rounded(standardError),
    oneHitStep: rounded(oneHitStep),
    minimumLift: rounded(minimumLift),
    minimumHits,
  };
}

function gateFromEvidence(baselineRate: number, walkForwardRows: number): EchoGateProfile {
  const evidence = echoEvidenceFor(baselineRate, walkForwardRows, 0.25);
  const minimumScore = Math.round(55 + Math.min(4, evidence.standardError * 0.22));
  const minimumConfidence = Math.round(48 + Math.min(5, evidence.standardError * 0.18));
  const maximumValidationDrop = rounded(Math.max(
    evidence.oneHitStep * 2,
    Math.min(30, evidence.standardError * 1.8),
  ));
  const softHoldoutFloor = evidence.rows <= 12
    ? -rounded(Math.min(3, evidence.standardError * 0.2))
    : 0;

  return {
    minimumScore,
    minimumConfidence,
    minimumEffectiveNeighbors: 5,
    minimumDiscoveryLift: rounded(Math.min(4, evidence.standardError * 0.12)),
    minimumValidationLift: evidence.minimumLift,
    minimumValidationHits: evidence.minimumHits,
    minimumValidationRows: 6,
    minimumHoldoutRows: 6,
    maximumValidationDrop,
    softHoldoutFloor,
    baselineRate: evidence.baselineRate,
    walkForwardRows: evidence.rows,
    standardError: evidence.standardError,
    oneHitStep: evidence.oneHitStep,
  };
}

export function echoGateFor(baselineRate: number, walkForwardRows: number): EchoGateProfile;
export function echoGateFor(legacyMode: string, legacyDigitCount: number): EchoGateProfile;
export function echoGateFor(baselineOrLegacyMode: number | string, rowsOrDigitCount: number): EchoGateProfile {
  if (typeof baselineOrLegacyMode === "number") {
    return gateFromEvidence(baselineOrLegacyMode, rowsOrDigitCount);
  }

  // Compatibility for callers that have not yet supplied an evaluated baseline.
  // This fallback is universal: it does not distinguish mode names or digit counts.
  return gateFromEvidence(50, 12);
}

function metric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function buildCandidateDiagnostics(
  candidate: DiagnosticCandidate | null,
  _legacyMode?: unknown,
  _legacyDigitCount?: unknown,
): EchoDiagnostic[] {
  if (!candidate) {
    return [{
      code: "NO_QUALIFIED_PROFILE",
      phase: "candidate",
      label: "Tidak ada profile lengkap",
      detail: "Semua profile berhenti sebelum menghasilkan evaluasi discovery, validation, dan prediksi live yang lengkap.",
    }];
  }

  const gate = gateFromEvidence(candidate.validation.baselineRate, candidate.validation.total);
  const discoveryEvidence = echoEvidenceFor(
    candidate.discoveryFit.baselineRate,
    candidate.discoveryFit.total,
    0.12,
  );
  const diagnostics: EchoDiagnostic[] = [];

  if (candidate.score < gate.minimumScore) {
    diagnostics.push({
      code: "SCORE_BELOW_MINIMUM",
      phase: "candidate",
      label: "Skor evaluasi belum cukup",
      actual: candidate.score,
      required: gate.minimumScore,
      detail: `Skor ${metric(candidate.score)}; minimum ${gate.minimumScore} berdasarkan baseline ${metric(gate.baselineRate)}% dan ${gate.walkForwardRows} walk-forward.`,
    });
  }

  if (candidate.discoveryFit.lift < discoveryEvidence.minimumLift) {
    diagnostics.push({
      code: "NEGATIVE_DISCOVERY_LIFT",
      phase: "candidate",
      label: "Discovery belum memberi keunggulan cukup",
      actual: candidate.discoveryFit.lift,
      required: discoveryEvidence.minimumLift,
      detail: `Lift discovery ${metric(candidate.discoveryFit.lift)}%; minimum ${metric(discoveryEvidence.minimumLift)}% berdasarkan baseline ${metric(discoveryEvidence.baselineRate)}% dan ${discoveryEvidence.rows} pengujian.`,
    });
  }

  if (
    candidate.validation.hit < gate.minimumValidationHits ||
    candidate.validation.lift < gate.minimumValidationLift ||
    candidate.validation.rate < candidate.validation.baselineRate
  ) {
    diagnostics.push({
      code: "NEGATIVE_VALIDATION_LIFT",
      phase: "candidate",
      label: "Walk-forward belum memberi bukti cukup",
      actual: candidate.validation.hit,
      required: gate.minimumValidationHits,
      detail: `Hit ${candidate.validation.hit}/${candidate.validation.total}; minimum ${gate.minimumValidationHits}/${candidate.validation.total}. Lift ${metric(candidate.validation.lift)}%; kebutuhan ${metric(gate.minimumValidationLift)}% berdasarkan baseline ${metric(candidate.validation.baselineRate)}%.`,
    });
  }

  if (candidate.live.confidence < gate.minimumConfidence) {
    diagnostics.push({
      code: "LOW_CONFIDENCE",
      phase: "candidate",
      label: "Keyakinan live rendah",
      actual: candidate.live.confidence,
      required: gate.minimumConfidence,
      detail: `Confidence ${metric(candidate.live.confidence)}; minimum ${gate.minimumConfidence} untuk ${candidate.validation.total} walk-forward.`,
    });
  }

  if (candidate.live.quality.effectiveNeighbors < gate.minimumEffectiveNeighbors) {
    diagnostics.push({
      code: "LOW_EFFECTIVE_SAMPLE",
      phase: "candidate",
      label: "Sampel efektif terlalu sedikit",
      actual: candidate.live.quality.effectiveNeighbors,
      required: gate.minimumEffectiveNeighbors,
      detail: `Effective sample ${metric(candidate.live.quality.effectiveNeighbors)}; minimum ${metric(gate.minimumEffectiveNeighbors)}.`,
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
  holdoutGate: EchoGateProfile,
): EchoReleaseEvidence {
  const total = candidate.validation.total + holdout.total;
  const hits = candidate.validation.hit + holdout.hit;
  const baselineRate = total > 0
    ? (
      candidate.validation.baselineRate * candidate.validation.total +
      holdout.baselineRate * holdout.total
    ) / total
    : 0;
  const priorStrength = Math.max(4, Math.min(8, Math.round(Math.sqrt(total))));
  const posteriorRate = total > 0
    ? ((hits + (baselineRate / 100) * priorStrength) / (total + priorStrength)) * 100
    : 0;
  const evidenceLift = posteriorRate - baselineRate;
  const validationEvidence = echoEvidenceFor(
    candidate.validation.baselineRate,
    candidate.validation.total,
    0.25,
  );
  const combinedEvidence = echoEvidenceFor(baselineRate, total, 0.12);
  const softAccepted =
    holdoutGate.softHoldoutFloor < 0 &&
    holdout.lift < 0 &&
    holdout.lift >= holdoutGate.softHoldoutFloor &&
    candidate.validation.hit >= validationEvidence.minimumHits &&
    evidenceLift >= combinedEvidence.minimumLift;

  return {
    holdoutFloor: holdoutGate.softHoldoutFloor,
    combinedRate: rounded(posteriorRate),
    combinedBaselineRate: rounded(baselineRate),
    combinedLift: rounded(evidenceLift),
    softAccepted,
  };
}

export function evaluateHoldoutRelease(
  candidate: DiagnosticCandidate,
  holdout: EchoPhaseAudit,
  finalScore: number,
  _legacyMode?: unknown,
  _legacyDigitCount?: unknown,
): { diagnostics: EchoDiagnostic[]; evidence: EchoReleaseEvidence } {
  const validationGate = gateFromEvidence(candidate.validation.baselineRate, candidate.validation.total);
  const holdoutGate = gateFromEvidence(holdout.baselineRate, holdout.total);
  const holdoutEvidence = echoEvidenceFor(holdout.baselineRate, holdout.total, 0.1);
  const combinedBaseline = (
    candidate.validation.baselineRate * candidate.validation.total +
    holdout.baselineRate * holdout.total
  ) / Math.max(1, candidate.validation.total + holdout.total);
  const combinedGate = gateFromEvidence(combinedBaseline, candidate.validation.total + holdout.total);
  const evidence = releaseEvidence(candidate, holdout, holdoutGate);
  const diagnostics: EchoDiagnostic[] = [];
  const allowedHits = evidence.softAccepted
    ? Math.max(0, holdoutEvidence.minimumHits - 1)
    : holdoutEvidence.minimumHits;
  const maximumMissStreak = Math.max(3, Math.floor(holdout.total / 3));
  const validationDrop = candidate.validation.rate - holdout.rate;
  const maximumValidationDrop = Math.max(
    validationGate.maximumValidationDrop,
    holdoutGate.maximumValidationDrop,
  );

  if (holdout.total < holdoutGate.minimumHoldoutRows) {
    diagnostics.push({
      code: "INSUFFICIENT_HOLDOUT",
      phase: "holdout",
      label: "Sampel verifikasi akhir belum cukup",
      actual: holdout.total,
      required: holdoutGate.minimumHoldoutRows,
      detail: `Tersedia ${holdout.total} pengujian; minimum ${holdoutGate.minimumHoldoutRows}.`,
    });
  }

  if (holdout.hit < allowedHits) {
    diagnostics.push({
      code: "HOLDOUT_HIT_BELOW_BASELINE",
      phase: "holdout",
      label: "Hit verifikasi di bawah kebutuhan",
      actual: holdout.hit,
      required: allowedHits,
      detail: `Hit ${holdout.hit}/${holdout.total}; minimum ${allowedHits}/${holdout.total} berdasarkan baseline ${metric(holdout.baselineRate)}% dan jumlah verifikasi.`,
    });
  }

  if (holdout.lift < holdoutEvidence.minimumLift && !evidence.softAccepted) {
    diagnostics.push({
      code: "NEGATIVE_HOLDOUT_LIFT",
      phase: "holdout",
      label: "Verifikasi akhir belum memberi bukti cukup",
      actual: holdout.lift,
      required: holdoutEvidence.minimumLift,
      detail: `Lift holdout ${metric(holdout.lift)}%; kebutuhan ${metric(holdoutEvidence.minimumLift)}% berdasarkan baseline ${metric(holdout.baselineRate)}% dan ${holdout.total} verifikasi. Bukti gabungan ${metric(evidence.combinedLift)}%.`,
    });
  }

  if (validationDrop > maximumValidationDrop) {
    diagnostics.push({
      code: "EXCESSIVE_VALIDATION_DROP",
      phase: "holdout",
      label: "Performa turun terlalu tajam",
      actual: validationDrop,
      required: maximumValidationDrop,
      detail: `Penurunan walk-forward ke holdout ${metric(validationDrop)} poin; maksimum ${metric(maximumValidationDrop)} berdasarkan ketidakpastian sampel.`,
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

  const minimumFinalScore = evidence.softAccepted
    ? combinedGate.minimumScore + 2
    : combinedGate.minimumScore;
  if (finalScore < minimumFinalScore) {
    diagnostics.push({
      code: "LOW_FINAL_SCORE",
      phase: "holdout",
      label: "Skor akhir belum cukup",
      actual: finalScore,
      required: minimumFinalScore,
      detail: `Skor akhir ${metric(finalScore)}; minimum release ${minimumFinalScore} berdasarkan baseline gabungan ${metric(combinedBaseline)}% dan ${candidate.validation.total + holdout.total} pengujian.`,
    });
  }

  return { diagnostics, evidence };
}

export function buildHoldoutDiagnostics(
  candidate: DiagnosticCandidate,
  holdout: EchoPhaseAudit,
  finalScore: number,
  _legacyMode?: unknown,
  _legacyDigitCount?: unknown,
): EchoDiagnostic[] {
  return evaluateHoldoutRelease(candidate, holdout, finalScore).diagnostics;
}
