import assert from "node:assert/strict";
import { runMovementEngine } from "../lib/movement/engine";
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

const draws = Array.from({ length: 180 }, (_, index) => {
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
assert.equal(position.digits.length, 7);
assert.equal(position.offDigits.length, 3);

const ai = runMovementEngine(draws, {
  outputType: "ai",
  target: "2d_belakang",
  digitCount: 4,
});
assert.equal(ai.digits.length, 4);
assert.equal(ai.evaluation.holdout.baseline, 64);

const bbfs = runMovementEngine(draws, {
  outputType: "bbfs",
  target: "4d",
  digitCount: 8,
});
assert.equal(bbfs.digits.length, 8);
assert.equal(bbfs.offDigits.length, 2);
assert.equal(bbfs.evaluation.holdout.baseline, 41);
assert.equal(bbfs.config.targetPositions.join(""), "ACKE");

console.log("Movement invariants passed.");
