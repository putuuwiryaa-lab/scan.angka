import assert from "node:assert/strict";
import {
  PERSISTENT_LIVE_MAX_BLEND,
  applyPersistentLiveWeights,
  type AdaptiveLiveModelWeight,
} from "../lib/movement/persistent-live";
import type { MovementShadowPrediction } from "../lib/movement/shadow";
import type { MovementProbability, MovementResult } from "../lib/movement/types";

function probabilities(highDigits: number[]): MovementProbability[] {
  const high = new Set(highDigits);
  const raw = Array.from({ length: 10 }, (_, digit) => ({
    digit,
    score: high.has(digit) ? 21 : 2.6666667,
  }));
  return raw.sort((left, right) => right.score - left.score || left.digit - right.digit);
}

const baseResult = {
  config: {
    outputType: "ai",
    target: "2d_belakang",
    digitCount: 4,
    targetPositions: ["K", "E"],
    sourceDataSize: 168,
    walkForwardSize: 14,
    windows: [14],
    candidateCount: 2,
  },
  latestDraw: "1234",
  digits: [0, 1, 2, 3],
  offDigits: [4, 5, 6, 7, 8, 9],
  objective: "AI 2D",
  strength: "CUKUP",
  confidence: 70,
  regime: "CHAOTIC",
  selectedMethod: "delta",
  selectedWindow: 14,
  probabilities: probabilities([0, 1, 2, 3]),
  evaluation: {
    l14: { hit: 9, total: 14, rate: 0.642857, longestMissStreak: 2 },
    l7: { hit: 5, total: 7, rate: 0.714286, longestMissStreak: 1 },
    l3: { hit: 2, total: 3, rate: 0.666667, longestMissStreak: 1 },
  },
  selectionValidation: { hit: 9, total: 14, rate: 0.642857, longestMissStreak: 2 },
  tieBreakStatus: "not_needed",
  tieBreakInitialCandidateCount: 1,
  tieBreakRounds: [],
  tournament: [],
  rows: [],
  message: "Delta Movement W14 unggul.",
} as unknown as MovementResult;

const shadows: MovementShadowPrediction[] = [
  {
    initialRank: 1,
    method: "delta",
    window: 14,
    digits: [0, 1, 2, 3],
    probabilities: probabilities([0, 1, 2, 3]),
    selectionScore: 0.84,
    runnerUpScore: 0.65,
    margin: 0.19,
    evaluation: { hit: 9, total: 14, rate: 0.642857, longestMissStreak: 2 },
    l7Hit: 5,
    l3Hit: 2,
    meanProbability: 84,
  },
  {
    initialRank: 2,
    method: "cycle",
    window: 14,
    digits: [4, 5, 6, 7],
    probabilities: probabilities([4, 5, 6, 7]),
    selectionScore: 0.84,
    runnerUpScore: 0.65,
    margin: 0.19,
    evaluation: { hit: 8, total: 14, rate: 0.571429, longestMissStreak: 2 },
    l7Hit: 4,
    l3Hit: 2,
    meanProbability: 84,
  },
];

const inactive = applyPersistentLiveWeights(baseResult, shadows, []);
assert.equal(inactive.liveWeighting.applied, false);
assert.equal(inactive.liveWeighting.strength, 0);
assert.deepEqual(inactive.digits, baseResult.digits);

const belowMinimum: AdaptiveLiveModelWeight[] = [{
  method: "cycle",
  window: 14,
  decayedHits: 7,
  decayedTotal: 7,
  observations: 7,
}];
const stillInactive = applyPersistentLiveWeights(baseResult, shadows, belowMinimum);
assert.equal(stillInactive.liveWeighting.applied, false);

const matureWeights: AdaptiveLiveModelWeight[] = [
  {
    method: "delta",
    window: 14,
    decayedHits: 8,
    decayedTotal: 30,
    observations: 42,
  },
  {
    method: "cycle",
    window: 14,
    decayedHits: 28,
    decayedTotal: 30,
    observations: 42,
  },
];
const active = applyPersistentLiveWeights(baseResult, shadows, matureWeights);
assert.equal(active.liveWeighting.applied, true);
assert.equal(active.liveWeighting.eligibleSources, 2);
assert.equal(active.liveWeighting.averageObservationDepth, 42);
assert.ok(active.liveWeighting.strength > 0);
assert.ok(active.liveWeighting.strength <= PERSISTENT_LIVE_MAX_BLEND);
assert.notDeepEqual(active.probabilities, baseResult.probabilities);
assert.equal(active.digits.length, baseResult.config.digitCount);
assert.equal(new Set(active.digits).size, active.digits.length);
assert.match(active.message, /Overlay bobot live persisten aktif/);

console.log("Persistent live weighting remains gated, bounded, and deterministic.");
