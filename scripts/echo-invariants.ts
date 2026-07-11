import assert from "node:assert/strict";
import { echoGateFor, evaluateHoldoutRelease } from "../lib/echo/diagnostics";
import { familyGroupOf, selectFamilyRepresentatives, type EchoSelectableCandidate } from "../lib/echo/selection";
import type { EchoFamily } from "../lib/echo/types";

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
      variant: family === "ET" ? "transition1" : family === "EC" ? "cycleGap" : "local",
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
      hit: 0,
      total: 0,
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
      hit: 0,
      total: 0,
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
assert.equal(familyGroupOf("EN"), "ENSEMBLE");

const representatives = selectFamilyRepresentatives([
  selectable("EL", "EL-K", 6, 72, 61),
  selectable("EX", "EX-K", 2, 78, 90),
  selectable("ET", "ET1-K", 4, 70, 64),
  selectable("EC", "ECG-K", 3, 69, 63),
]);
assert.equal(representatives.length, 3);
assert.ok(representatives.some((candidate) => candidate.profile.formula === "EL-K"));
assert.ok(!representatives.some((candidate) => candidate.profile.formula === "EX-K"));

const aiGate = echoGateFor("ai_2d_belakang", 4);
const broadAiGate = echoGateFor("ai_2d_belakang", 8);
const shioGate = echoGateFor("shio", 4);
assert.equal(aiGate.minimumScore, 56);
assert.equal(aiGate.softHoldoutFloor, -3);
assert.equal(broadAiGate.minimumScore, 58);
assert.equal(broadAiGate.softHoldoutFloor, 0);
assert.ok(shioGate.minimumConfidence > aiGate.minimumConfidence);

const baseCandidate = {
  score: 70,
  discoveryFit: { lift: 8 },
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
  evaluateHoldoutRelease(baseCandidate, positiveHoldout, 70, "posisi", 4).diagnostics.length,
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
assert.ok(
  evaluateHoldoutRelease(baseCandidate, weakHoldout, 60, "posisi", 4).diagnostics.length > 0,
);

const strongValidationCandidate = {
  ...baseCandidate,
  validation: {
    hit: 17,
    total: 20,
    rate: 85,
    baselineRate: 60,
    lift: 25,
  },
};
const shortSampleHoldout = {
  statuses: Array.from({ length: 50 }, (_, index) => index < 29),
  rows: [],
  hit: 29,
  total: 50,
  rate: 58,
  baselineRate: 60,
  lift: -2,
  longestMissStreak: 2,
};
const softened = evaluateHoldoutRelease(
  strongValidationCandidate,
  shortSampleHoldout,
  70,
  "posisi",
  4,
);
assert.equal(softened.evidence.softAccepted, true);
assert.equal(softened.diagnostics.length, 0);

console.log("Echo invariants passed.");
