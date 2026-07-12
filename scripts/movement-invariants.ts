import assert from "node:assert/strict";
import { runMovementEngine } from "../lib/movement/engine";
import {
  buildTrainingWindows,
  minimumReleaseHits,
} from "../lib/movement/evaluator";
import {
  isCovered,
  theoreticalBaseline,
} from "../lib/movement/helpers";
import {
  buildJointPairDistribution,
  buildMethodDistributions,
} from "../lib/movement/models";
import {
  MOVEMENT_METHODS,
  PAIR_MOVEMENT_METHODS,
  POSITION_MOVEMENT_METHODS,
} from "../lib/movement/types";
import {
  ADAPTIVE_BATCH_CHUNK_SIZE,
  ADAPTIVE_BATCH_MODES,
  MAX_ADAPTIVE_BATCH_MARKETS,
  adaptiveOutputType,
  adaptiveTarget,
  adaptiveTargetKind,
  clampBatchDigitCount,
  isAdaptiveBatchMode,
  isBatchAnalysisMode,
  minimumAdaptiveDigitCount,
} from "../lib/shared/batch-analysis";

assert.equal(isCovered([0, 3, 5, 7], [2, 7], "ai"), true);
assert.equal(isCovered([0, 1, 3, 5], [2, 7], "ai"), false);
assert.equal(isCovered([0, 1, 2, 3, 4, 5, 7, 8], [5, 8, 2, 7], "bbfs"), true);
assert.equal(isCovered([0, 1, 2, 3, 4, 5, 7, 9], [5, 8, 2, 7], "bbfs"), false);
assert.equal(isCovered([0, 1, 2, 3, 4, 5, 7, 8], [5, 8, 8, 7], "bbfs"), true);

assert.equal(theoreticalBaseline("position", 7, 1), 70);
assert.equal(theoreticalBaseline("ai", 4, 2), 64);
assert.equal(theoreticalBaseline("bbfs", 8, 4), 41);
assert.deepEqual(buildTrainingWindows(168), [14, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154]);
assert.equal(minimumReleaseHits("position", 7, 1), 11);
assert.equal(minimumReleaseHits("ai", 4, 2), 10);
assert.equal(minimumReleaseHits("bbfs", 8, 4), 7);
assert.equal(POSITION_MOVEMENT_METHODS.length, 8);
assert.equal(PAIR_MOVEMENT_METHODS.length, 1);
assert.equal(MOVEMENT_METHODS.length, 9);
assert.ok(MOVEMENT_METHODS.every((method) => !method.includes("markov")));

assert.equal(ADAPTIVE_BATCH_MODES.length, 7);
assert.equal(MAX_ADAPTIVE_BATCH_MARKETS, 35);
assert.equal(ADAPTIVE_BATCH_CHUNK_SIZE, 5);
assert.equal(MAX_ADAPTIVE_BATCH_MARKETS % ADAPTIVE_BATCH_CHUNK_SIZE, 0);
assert.equal(isAdaptiveBatchMode("adaptive_ai_2d"), true);
assert.equal(isBatchAnalysisMode("bbfs_2d_belakang"), true);
assert.equal(isBatchAnalysisMode("adaptive_bbfs_4d"), true);
assert.equal(isBatchAnalysisMode("unknown"), false);
assert.equal(adaptiveOutputType("adaptive_position"), "position");
assert.equal(adaptiveOutputType("adaptive_ai_3d"), "ai");
assert.equal(adaptiveOutputType("adaptive_bbfs_4d"), "bbfs");
assert.equal(adaptiveTargetKind("adaptive_ai_2d"), "2d");
assert.equal(adaptiveTargetKind("adaptive_bbfs_3d"), "3d");
assert.equal(adaptiveTarget("adaptive_position", "K", "belakang", "belakang"), "K");
assert.equal(adaptiveTarget("adaptive_ai_2d", "K", "tengah", "belakang"), "2d_tengah");
assert.equal(adaptiveTarget("adaptive_bbfs_3d", "K", "belakang", "depan"), "3d_depan");
assert.equal(adaptiveTarget("adaptive_ai_4d", "K", "belakang", "belakang"), "4d");
assert.equal(minimumAdaptiveDigitCount("adaptive_bbfs_2d"), 2);
assert.equal(minimumAdaptiveDigitCount("adaptive_bbfs_3d"), 3);
assert.equal(minimumAdaptiveDigitCount("adaptive_bbfs_4d"), 4);
assert.equal(clampBatchDigitCount("adaptive_bbfs_4d", 2), 4);
assert.equal(clampBatchDigitCount("adaptive_ai_2d", 12), 9);
assert.equal(clampBatchDigitCount("shio", 12), 12);

const draws = Array.from({ length: 168 }, (_, index) => {
  const a = (index * 3 + Math.floor(index / 7)) % 10;
  const c = (index * 7 + Math.floor(index / 5)) % 10;
  const k = (index * 5 + a + Math.floor(index / 9)) % 10;
  const e = (index * 9 + c + Math.floor(index / 11)) % 10;
  return `${a}${c}${k}${e}`;
});

for (const method of POSITION_MOVEMENT_METHODS) {
  const distributions = buildMethodDistributions(draws.slice(0, 70), method);
  for (const distribution of Object.values(distributions)) {
    assert.equal(distribution.length, 10);
    assert.ok(distribution.every((value) => Number.isFinite(value) && value >= 0));
    assert.ok(Math.abs(distribution.reduce((sum, value) => sum + value, 0) - 1) < 1e-9);
  }
}

const jointPair = buildJointPairDistribution(draws.slice(0, 70), ["K", "E"]);
assert.equal(jointPair.length, 100);
assert.ok(jointPair.every((value) => Number.isFinite(value) && value >= 0));
assert.ok(Math.abs(jointPair.reduce((sum, value) => sum + value, 0) - 1) < 1e-9);

const position = runMovementEngine(draws, {
  outputType: "position",
  target: "K",
  digitCount: 7,
});
assert.equal(position.config.walkForwardSize, 14);
assert.equal(position.config.candidateCount, 88);
assert.equal(position.rows.length, 14);
assert.equal(position.selectedWindow % 14, 0);
assert.equal(position.minimumReleaseHits, 11);
assert.equal(position.digits.length, position.released ? 7 : 0);
assert.equal(position.offDigits.length, position.released ? 3 : 0);

const ai = runMovementEngine(draws, {
  outputType: "ai",
  target: "2d_belakang",
  digitCount: 4,
});
assert.equal(ai.config.candidateCount, 99);
assert.equal(ai.evaluation.l14.baseline, 64);
assert.equal(ai.evaluation.l14.total, 14);
assert.equal(ai.minimumReleaseHits, 10);
assert.equal(ai.digits.length, ai.released ? 4 : 0);

const bbfs = runMovementEngine(draws, {
  outputType: "bbfs",
  target: "4d",
  digitCount: 8,
});
assert.equal(bbfs.config.candidateCount, 88);
assert.equal(bbfs.evaluation.l14.baseline, 41);
assert.equal(bbfs.config.targetPositions.join(""), "ACKE");
assert.equal(bbfs.minimumReleaseHits, 7);
assert.equal(bbfs.digits.length, bbfs.released ? 8 : 0);
assert.equal(bbfs.offDigits.length, bbfs.released ? 2 : 0);

console.log("Movement adaptive tournament and 35-market Batch invariants passed.");
