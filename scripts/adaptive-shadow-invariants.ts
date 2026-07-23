import assert from "node:assert/strict";
import { runMovementEngine } from "../lib/movement/engine";
import { buildMovementShadowPredictions } from "../lib/movement/shadow";

const draws = Array.from({ length: 168 }, (_, index) => {
  const a = (index * 7 + 1) % 10;
  const c = (index * 3 + Math.floor(index / 4) + 2) % 10;
  const k = (index * 9 + Math.floor(index / 7) + 3) % 10;
  const e = (index * 5 + Math.floor(index / 11) + 4) % 10;
  return `${a}${c}${k}${e}`;
});

for (const config of [
  { outputType: "position" as const, target: "K" as const, digitCount: 7, expected: 99 },
  { outputType: "ai" as const, target: "2d_belakang" as const, digitCount: 4, expected: 110 },
  { outputType: "bbfs" as const, target: "4d" as const, digitCount: 8, expected: 99 },
]) {
  const result = runMovementEngine(draws, config);
  const shadows = buildMovementShadowPredictions(draws, result.config);

  assert.equal(shadows.length, config.expected);
  assert.equal(new Set(shadows.map((shadow) => `${shadow.method}:${shadow.window}`)).size, config.expected);
  assert.deepEqual(shadows.map((shadow) => shadow.initialRank), Array.from({ length: config.expected }, (_, index) => index + 1));
  assert.ok(shadows.every((shadow) => shadow.digits.length === config.digitCount));
  assert.ok(shadows.every((shadow) => shadow.evaluation.total === 14));
  assert.ok(shadows.every((shadow) => shadow.probabilities.length === 10));

  const selected = shadows.find((shadow) =>
    shadow.method === result.selectedMethod && shadow.window === result.selectedWindow,
  );
  assert.ok(selected);
}

console.log("Adaptive shadow predictions cover every method-window candidate with unique live outputs.");
