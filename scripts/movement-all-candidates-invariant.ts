import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runMovementEngine } from "../lib/movement/engine";

const evaluatorSource = readFileSync("lib/movement/evaluator.ts", "utf8");
const resolverStart = evaluatorSource.indexOf("function resolveHitTie(");
const resolverEnd = evaluatorSource.indexOf("function weightedLivePrediction(");
assert.ok(resolverStart >= 0 && resolverEnd > resolverStart);
const resolverSource = evaluatorSource.slice(resolverStart, resolverEnd);
assert.match(resolverSource, /const extended = rankedCandidates\.map\(/);
assert.doesNotMatch(resolverSource, /const extended = finalists\.map\(/);

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
assert.ok(fullyTied.message.includes(`Seluruh ${fullyTied.config.candidateCount} konfigurasi`));

console.log("All candidates are retested when a walk-forward round is tied.");
