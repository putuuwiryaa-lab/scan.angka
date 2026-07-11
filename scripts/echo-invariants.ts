import assert from "node:assert/strict";
import {
  buildCandidateDiagnostics,
  echoEvidenceFor,
  echoGateFor,
  evaluateHoldoutRelease,
} from "../lib/echo/diagnostics";
import { familyGroupOf, selectFamilyRepresentatives, type EchoSelectableCandidate } from "../lib/echo/selection";
import type { EchoFamily, EchoVariant } from "../lib/echo/types";

function variantFor(family: EchoFamily): EchoVariant {
  if (family === "ET") return "transition1";
  if (family === "EC") return "cycleGap";
  if (family === "EP") return "pairGap";
  if (family === "EF") return "frequencyHot";
  if (family === "EM") return "momentumTrend";
  if (family === "EN") return "ensemble";
  return "local";
}

function selectable(
  family: EchoFamily,
  formula: string,
  discoveryLift: number,
  weightedAccuracy: number,
  score: number,
): EchoSelectableCandidate {
  return {
    profile: {
      family,
      formula,
      variant: variantFor(family),
      anchorPos: "K",
      sourceKind: "position",
      areaPositions: [],
    },
    rows: [],
    split: { discovery: [], validation: [], holdout: [] },
    discoveryFit: {
      columns: [],
      statuses: [],
      rows: [],
      hit: 26,
      total: 36,
      rate: weightedAccuracy,
      weightedAccuracy,
      baselineRate: weightedAccuracy - discoveryLift,
      lift: discoveryLift,
      windowStability: 80,
      strongestWindow: 12,
      weakestWindow: 24,
      windows: [{ window: 12, weight: 1, hit: 9, total: 12, rate: 75, longestMissStreak: 1 }],
      longestMissStreak: 1,
      efficiency: 0.7,
    },
    validation: {
      statuses: [],
      rows: [],
      hit: 7,
      total: 10,
      rate: 70,
      baselineRate: 60,
      lift: 10,
      longestMissStreak: 1,
    },
    productionFit: {
      columns: [],
      statuses: [],
      rows: [],
      hit: 26,
      total: 36,
      rate: weightedAccuracy,
      weightedAccuracy,
      baselineRate: weightedAccuracy - discoveryLift,
      lift: discoveryLift,
      windowStability: 80,
      strongestWindow: 12,
      weakestWindow: 24,
      windows: [],
      longestMissStreak: 1,
      efficiency: 0.7,
    },
    live: {
      patokan: 1,
      confidence: 65,
      confidenceLevel: "MEDIUM",
      quality: {
        neighborCount: 8,
        effectiveNeighbors: 7,
        meanDistance: 0.2,
        dominantShare: 55,
        stability: 70,
        ensembleStability: 70,
        regimeAgreement: 65,
        regime: "MIXED",
      },
      neighbors: [],
    },
    liveDigits: [1, 2, 3, 4],
    score,
  };
}

assert.equal(familyGroupOf("EL"), "ANALOG");
assert.equal(familyGroupOf("ET"), "TRANSITION");
assert.equal(familyGroupOf("EC"), "CYCLE");
assert.equal(familyGroupOf("EP"), "PAIR");
assert.equal(familyGroupOf("EF"), "FREQUENCY");
assert.equal(familyGroupOf("EM"), "MOMENTUM");
assert.equal(familyGroupOf("EN"), "ENSEMBLE");

const representatives = selectFamilyRepresentatives([
  selectable("EL", "EL-K", 6, 72, 61),
  selectable("EX", "EX-K", 2, 78, 90),
  selectable("ET", "ET1-K", 4, 70, 64),
  selectable("EC", "ECG-K", 3, 69, 63),
  selectable("EF", "EFH-K", 5, 71, 65),
  selectable("EM", "EMT-K", 4, 70, 64),
]);
assert.equal(representatives.length, 5);
assert.ok(representatives.some((candidate) => candidate.profile.formula === "EL-K"));
assert.ok(!representatives.some((candidate) => candidate.profile.formula === "EX-K"));
assert.ok(representatives.some((candidate) => candidate.profile.formula === "EFH-K"));
assert.ok(representatives.some((candidate) => candidate.profile.formula === "EMT-K"));

// The gate is driven by baseline and sample count, not analysis labels.
const baseline64At12 = echoGateFor(64, 12);
const sameBaseline64At12 = echoGateFor(64, 12);
const baseline49At12 = echoGateFor(49, 12);
const baseline64At24 = echoGateFor(64, 24);
assert.deepEqual(baseline64At12, sameBaseline64At12);
assert.equal(baseline64At12.minimumValidationHits, 9);
assert.equal(baseline49At12.minimumValidationHits, 7);
assert.equal(baseline64At24.minimumValidationHits, 16);
assert.ok(baseline64At24.minimumValidationLift < baseline64At12.minimumValidationLift);
assert.ok(baseline64At24.standardError < baseline64At12.standardError);

const aiLikeEvidence = echoEvidenceFor(64, 12);
const bbfsLikeEvidence = echoEvidenceFor(64, 12);
assert.deepEqual(aiLikeEvidence, bbfsLikeEvidence);

const baseCandidate = {
  score: 70,
  discoveryFit: {
    lift: 8,
    baselineRate: 60,
    total: 36,
  },
  validation: {
    hit: 8,
    total: 10,
    rate: 80,
    baselineRate: 60,
    lift: 20,
  },
  live: {
    confidence: 70,
    quality: {
      neighborCount: 8,
      effectiveNeighbors: 7,
      meanDistance: 0.2,
      dominantShare: 55,
      stability: 70,
      ensembleStability: 70,
      regimeAgreement: 65,
      regime: "MIXED" as const,
    },
  },
};
assert.equal(buildCandidateDiagnostics(baseCandidate).length, 0);

const marginalBaseline64Candidate = {
  ...baseCandidate,
  validation: {
    hit: 8,
    total: 12,
    rate: 66.7,
    baselineRate: 64,
    lift: 2.7,
  },
};
assert.ok(buildCandidateDiagnostics(marginalBaseline64Candidate)
  .some((diagnostic) => diagnostic.code === "NEGATIVE_VALIDATION_LIFT"));

const supportedBaseline64Candidate = {
  ...baseCandidate,
  validation: {
    hit: 9,
    total: 12,
    rate: 75,
    baselineRate: 64,
    lift: 11,
  },
};
assert.ok(!buildCandidateDiagnostics(supportedBaseline64Candidate)
  .some((diagnostic) => diagnostic.code === "NEGATIVE_VALIDATION_LIFT"));

const positiveHoldout = {
  statuses: [true, true, false, true, true, false, true, true, true, false],
  rows: [],
  hit: 7,
  total: 10,
  rate: 70,
  baselineRate: 60,
  lift: 10,
  longestMissStreak: 1,
};
assert.equal(
  evaluateHoldoutRelease(baseCandidate, positiveHoldout, 70).diagnostics.length,
  0,
);

const weakHoldout = {
  ...positiveHoldout,
  statuses: [false, false, true, false, false, true, false, false, true, false],
  hit: 3,
  rate: 30,
  lift: -30,
  longestMissStreak: 2,
};
assert.ok(evaluateHoldoutRelease(baseCandidate, weakHoldout, 60).diagnostics.length > 0);

const strongValidationCandidate = {
  ...baseCandidate,
  validation: {
    hit: 18,
    total: 20,
    rate: 90,
    baselineRate: 67,
    lift: 23,
  },
};
const nearBaselineShortHoldout = {
  statuses: [true, true, true, true, true, true, true, true, false, false, false, false],
  rows: [],
  hit: 8,
  total: 12,
  rate: 66.7,
  baselineRate: 67,
  lift: -0.3,
  longestMissStreak: 4,
};
const softened = evaluateHoldoutRelease(
  strongValidationCandidate,
  nearBaselineShortHoldout,
  70,
);
assert.equal(softened.evidence.softAccepted, true);

console.log("Echo invariants passed.");
