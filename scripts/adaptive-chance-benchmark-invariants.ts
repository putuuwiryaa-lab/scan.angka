import assert from "node:assert/strict";
import {
  ADAPTIVE_CHANCE_MODEL_VERSION,
  adaptiveChanceBenchmark,
  summarizeChanceBenchmark,
} from "../lib/movement/chance-benchmark";

function closeTo(actual: number, expected: number, tolerance = 1e-10): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

const position = adaptiveChanceBenchmark("position", "K", 7, "5678");
closeTo(position.probability, 0.7);
assert.equal(position.uniqueTargetCount, 1);
assert.equal(position.modelVersion, ADAPTIVE_CHANCE_MODEL_VERSION);

const aiDistinct = adaptiveChanceBenchmark("ai", "2d_belakang", 4, "5678");
closeTo(aiDistinct.probability, 2 / 3);
assert.equal(aiDistinct.uniqueTargetCount, 2);

const aiRepeated = adaptiveChanceBenchmark("ai", "2d_belakang", 4, "5666");
closeTo(aiRepeated.probability, 0.4);
assert.equal(aiRepeated.uniqueTargetCount, 1);

const bbfsDistinct = adaptiveChanceBenchmark("bbfs", "2d_belakang", 4, "5678");
closeTo(bbfsDistinct.probability, 2 / 15);
assert.equal(bbfsDistinct.uniqueTargetCount, 2);

const bbfsRepeated = adaptiveChanceBenchmark("bbfs", "2d_belakang", 4, "5666");
closeTo(bbfsRepeated.probability, 0.4);
assert.equal(bbfsRepeated.uniqueTargetCount, 1);

const bbfsFourDistinct = adaptiveChanceBenchmark("bbfs", "4d", 8, "1234");
closeTo(bbfsFourDistinct.probability, 1 / 3);
assert.equal(bbfsFourDistinct.uniqueTargetCount, 4);

const summary = summarizeChanceBenchmark([
  { isHit: true, chanceProbability: 0.5 },
  { isHit: false, chanceProbability: 0.25 },
  { isHit: true, chanceProbability: 0.75 },
  { isHit: true, chanceProbability: null },
]);

assert.deepEqual(summary, {
  sampleSize: 3,
  observedHits: 2,
  observedHitRate: 66.67,
  expectedHits: 1.5,
  expectedHitRate: 50,
  edgeHits: 0.5,
  edgePoints: 16.67,
});

console.log("Adaptive chance benchmark remains exact, conditional, and publication-neutral.");
