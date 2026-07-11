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

const draws = Array.from({ length: 168 }, (_, index) => {
  const a = (index * 3 + Math.floor(index / 7)) % 10;
  const c = (index * 7 + Math.floor(index / 5)) % 10;
  const k = (index * 5 + a + Math.floor(index / 9)) % 10;
  const e = (index * 9 + c + Math.floor(index / 11)) % 10;
  return `${a}${c}${k}${e}`;
});

const position = runMovementEngine(draws, {
  outputType: "position",
  target: "K",
  digitCount: 7,
});
assert.equal(position.config.walkForwardSize, 14);
assert.equal(position.config.candidateCount, 44);
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
assert.equal(ai.config.candidateCount, 55);
assert.equal(ai.evaluation.l14.baseline, 64);
assert.equal(ai.evaluation.l14.total, 14);
assert.equal(ai.minimumReleaseHits, 10);
assert.ok(ai.tournament.some((candidate) => candidate.method === "joint_pair"));
assert.equal(ai.digits.length, ai.released ? 4 : 0);

const bbfs = runMovementEngine(draws, {
  outputType: "bbfs",
  target: "4d",
  digitCount: 8,
});
assert.equal(bbfs.config.candidateCount, 44);
assert.equal(bbfs.evaluation.l14.baseline, 41);
assert.equal(bbfs.config.targetPositions.join(""), "ACKE");
assert.equal(bbfs.minimumReleaseHits, 7);
assert.equal(bbfs.digits.length, bbfs.released ? 8 : 0);
assert.equal(bbfs.offDigits.length, bbfs.released ? 2 : 0);

console.log("Movement L14 tournament invariants passed.");
