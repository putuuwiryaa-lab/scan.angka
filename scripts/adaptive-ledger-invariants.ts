import assert from "node:assert/strict";
import {
  adaptivePredictionKey,
  resolveAdaptiveSettlement,
  type PendingAdaptivePrediction,
} from "../lib/server/adaptive-ledger";
import type { MovementResult } from "../lib/movement/types";

const result = {
  latestDraw: "1234",
  selectedMethod: "delta",
  selectedWindow: 28,
  config: {
    outputType: "position",
    target: "K",
    digitCount: 7,
    sourceDataSize: 42,
  },
} as MovementResult;

const key = adaptivePredictionKey("market-a", result);
assert.equal(key, adaptivePredictionKey("market-a", result));
assert.notEqual(key, adaptivePredictionKey("market-b", result));
assert.notEqual(key, adaptivePredictionKey("market-a", {
  ...result,
  config: { ...result.config, sourceDataSize: 43 },
}));

const basePrediction: PendingAdaptivePrediction = {
  id: "prediction-1",
  source_result: "1234",
  source_history_size: 2,
  output_type: "position",
  target: "K",
  selected_digits: [7],
};

assert.deepEqual(
  resolveAdaptiveSettlement(basePrediction, ["0000", "1234"]),
  { status: "waiting" },
);

assert.deepEqual(
  resolveAdaptiveSettlement(basePrediction, ["0000", "1234", "5678", "9999"]),
  { status: "settled", actualResult: "5678", isHit: true },
);

assert.deepEqual(
  resolveAdaptiveSettlement(
    { ...basePrediction, selected_digits: [0, 1] },
    ["0000", "1234", "5678"],
  ),
  { status: "settled", actualResult: "5678", isHit: false },
);

assert.deepEqual(
  resolveAdaptiveSettlement(
    {
      ...basePrediction,
      output_type: "ai",
      target: "2d_belakang",
      selected_digits: [8],
    },
    ["0000", "1234", "5678"],
  ),
  { status: "settled", actualResult: "5678", isHit: true },
);

assert.deepEqual(
  resolveAdaptiveSettlement(
    {
      ...basePrediction,
      output_type: "bbfs",
      target: "2d_belakang",
      selected_digits: [7],
    },
    ["0000", "1234", "5678"],
  ),
  { status: "settled", actualResult: "5678", isHit: false },
);

const changedHistory = resolveAdaptiveSettlement(
  basePrediction,
  ["0000", "4321", "5678"],
);
assert.equal(changedHistory.status, "invalidated");

console.log("Adaptive prediction key, next-result settlement, and history-integrity invariants passed.");
