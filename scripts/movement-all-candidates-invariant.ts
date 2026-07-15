import assert from "node:assert/strict";
import { runMovementEngine } from "../lib/movement/engine";

function seededDraws(seed: number): string[] {
  let state = seed >>> 0;
  return Array.from({ length: 35 }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return String(state % 10000).padStart(4, "0");
  });
}

let subsetTie: ReturnType<typeof runMovementEngine> | undefined;
for (let seed = 1; seed <= 200; seed += 1) {
  const result = runMovementEngine(seededDraws(seed), {
    outputType: "position",
    target: "K",
    digitCount: 7,
  });
  if (
    result.tieBreakInitialCandidateCount > 1 &&
    result.tieBreakInitialCandidateCount < result.config.candidateCount &&
    result.tieBreakRounds.length > 0
  ) {
    subsetTie = result;
    break;
  }
}

assert.ok(subsetTie, "Skenario seri sebagian L14 tidak ditemukan.");
assert.ok(subsetTie.tieBreakInitialCandidateCount < subsetTie.config.candidateCount);
assert.ok(subsetTie.tieBreakRounds.every((round) =>
  round.candidateCount === subsetTie?.config.candidateCount &&
  round.candidates.length === subsetTie?.config.candidateCount,
));
assert.ok(subsetTie.message.includes(`seluruh ${subsetTie.config.candidateCount} konfigurasi`));

const fullyTied = runMovementEngine(Array.from({ length: 42 }, () => "0000"), {
  outputType: "position",
  target: "K",
  digitCount: 7,
});
assert.equal(fullyTied.tieBreakRounds.length, 2);
assert.ok(fullyTied.tieBreakRounds.every((round) =>
  round.candidateCount === fullyTied.config.candidateCount &&
  round.candidates.length === fullyTied.config.candidateCount,
));

console.log("All candidates are retested when a walk-forward round is tied.");
