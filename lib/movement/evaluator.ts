import type { Draw, Posisi } from "../engine/types";
import {
  evaluationOf,
  isCovered,
  targetDigitsOf,
} from "./helpers";
import {
  blendDistributions,
  buildComponentDistributions,
  type ComponentDistributions,
} from "./models";
import {
  chooseMovementDigits,
  objectiveProbability,
  type MovementSelection,
} from "./optimizer";
import type {
  MovementAuditRow,
  MovementEvaluation,
  MovementOutputType,
  MovementWeights,
  PositionDistributions,
} from "./types";

interface WeightProfile {
  name: string;
  weights: MovementWeights;
}

interface CachedTarget {
  targetIndex: number;
  targetDraw: Draw;
  targetDigits: number[];
  components: ComponentDistributions;
}

interface ProfileRun {
  profile: WeightProfile;
  evaluation: MovementEvaluation;
  meanProbability: number;
  score: number;
  statuses: boolean[];
  rows: MovementAuditRow[];
}

export interface MovementEvaluationPlan {
  validationStart: number;
  holdoutStart: number;
  validationSize: number;
  holdoutSize: number;
  recentStart: number;
}

export interface MovementEvaluationBundle {
  plan: MovementEvaluationPlan;
  profileName: string;
  weights: MovementWeights;
  validation: MovementEvaluation;
  holdout: MovementEvaluation;
  l15: MovementEvaluation;
  l30: MovementEvaluation;
  l60: MovementEvaluation;
  rows: MovementAuditRow[];
  liveDistributions: PositionDistributions;
  liveSelection: MovementSelection;
}

const WEIGHT_PROFILES: WeightProfile[] = [
  { name: "Seimbang", weights: { transition: 0.3, motif: 0.3, cycle: 0.15, cross: 0.25 } },
  { name: "Transisi", weights: { transition: 0.5, motif: 0.2, cycle: 0.1, cross: 0.2 } },
  { name: "Motif", weights: { transition: 0.2, motif: 0.5, cycle: 0.1, cross: 0.2 } },
  { name: "Struktur", weights: { transition: 0.2, motif: 0.2, cycle: 0.1, cross: 0.5 } },
  { name: "Siklus", weights: { transition: 0.25, motif: 0.2, cycle: 0.35, cross: 0.2 } },
  { name: "Gerak", weights: { transition: 0.4, motif: 0.35, cycle: 0.05, cross: 0.2 } },
  { name: "Relasi", weights: { transition: 0.25, motif: 0.25, cycle: 0.05, cross: 0.45 } },
];

export function buildMovementEvaluationPlan(totalData: number): MovementEvaluationPlan {
  if (totalData < 80) {
    throw new Error("Data belum cukup. Movement Engine membutuhkan minimal 80 result.");
  }

  const holdoutSize = totalData >= 120 ? 15 : 10;
  const validationSize = totalData >= 180 ? 45 : totalData >= 120 ? 30 : 20;
  const holdoutStart = totalData - holdoutSize;
  const validationStart = holdoutStart - validationSize;
  const recentStart = Math.max(40, totalData - 60);

  if (validationStart < 40) {
    throw new Error("Data belum cukup untuk membentuk training, walk-forward, dan holdout.");
  }

  return {
    validationStart,
    holdoutStart,
    validationSize,
    holdoutSize,
    recentStart,
  };
}

function buildCache(
  draws: Draw[],
  start: number,
  targetPositions: Posisi[],
): CachedTarget[] {
  const cache: CachedTarget[] = [];
  for (let targetIndex = start; targetIndex < draws.length; targetIndex += 1) {
    cache.push({
      targetIndex,
      targetDraw: draws[targetIndex],
      targetDigits: targetDigitsOf(draws[targetIndex], targetPositions),
      components: buildComponentDistributions(draws.slice(0, targetIndex)),
    });
  }
  return cache;
}

function evaluateCached(
  cache: CachedTarget[],
  profile: WeightProfile,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
  phase: MovementAuditRow["phase"],
): ProfileRun {
  const statuses: boolean[] = [];
  const rows: MovementAuditRow[] = [];
  let probabilityTotal = 0;

  for (const target of cache) {
    const distributions = blendDistributions(target.components, profile.weights);
    const selection = chooseMovementDigits(distributions, targetPositions, outputType, digitCount);
    const covered = isCovered(selection.digits, target.targetDigits, outputType);
    const eventProbability = objectiveProbability(
      distributions,
      targetPositions,
      outputType,
      selection.digits,
    );

    statuses.push(covered);
    probabilityTotal += eventProbability;
    rows.push({
      targetIndex: target.targetIndex,
      targetDraw: target.targetDraw,
      outputDigits: selection.digits,
      targetDigits: target.targetDigits,
      covered,
      phase,
    });
  }

  const evaluation = evaluationOf(statuses, outputType, digitCount, targetPositions.length);
  const meanProbability = cache.length ? (probabilityTotal / cache.length) * 100 : 0;
  const recentRate = statuses.length
    ? statuses.slice(-Math.min(10, statuses.length)).filter(Boolean).length /
      Math.min(10, statuses.length) * 100
    : 0;
  const score = evaluation.lift + meanProbability * 0.08 + recentRate * 0.025 -
    evaluation.longestMissStreak * 1.5;

  return {
    profile,
    evaluation,
    meanProbability: Number(meanProbability.toFixed(2)),
    score: Number(score.toFixed(3)),
    statuses,
    rows,
  };
}

function recentEvaluation(
  run: ProfileRun,
  size: number,
  outputType: MovementOutputType,
  digitCount: number,
  targetPositionCount: number,
): MovementEvaluation {
  return evaluationOf(
    run.statuses.slice(-Math.min(size, run.statuses.length)),
    outputType,
    digitCount,
    targetPositionCount,
  );
}

export function evaluateMovement(
  draws: Draw[],
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): MovementEvaluationBundle {
  const plan = buildMovementEvaluationPlan(draws.length);
  const recentCache = buildCache(draws, plan.recentStart, targetPositions);
  const validationCache = recentCache.filter((target) =>
    target.targetIndex >= plan.validationStart && target.targetIndex < plan.holdoutStart,
  );
  const holdoutCache = recentCache.filter((target) => target.targetIndex >= plan.holdoutStart);

  const validationRuns = WEIGHT_PROFILES.map((profile) =>
    evaluateCached(validationCache, profile, targetPositions, outputType, digitCount, "validation"),
  ).sort((left, right) =>
    right.score - left.score ||
    right.evaluation.lift - left.evaluation.lift ||
    right.evaluation.rate - left.evaluation.rate ||
    left.evaluation.longestMissStreak - right.evaluation.longestMissStreak ||
    left.profile.name.localeCompare(right.profile.name),
  );

  const selected = validationRuns[0];
  if (!selected) throw new Error("Tidak ada profil Movement yang dapat dievaluasi.");

  const holdout = evaluateCached(
    holdoutCache,
    selected.profile,
    targetPositions,
    outputType,
    digitCount,
    "holdout",
  );
  const recent = evaluateCached(
    recentCache,
    selected.profile,
    targetPositions,
    outputType,
    digitCount,
    "recent",
  );
  const liveComponents = buildComponentDistributions(draws);
  const liveDistributions = blendDistributions(liveComponents, selected.profile.weights);
  const liveSelection = chooseMovementDigits(
    liveDistributions,
    targetPositions,
    outputType,
    digitCount,
  );

  return {
    plan,
    profileName: selected.profile.name,
    weights: selected.profile.weights,
    validation: selected.evaluation,
    holdout: holdout.evaluation,
    l15: recentEvaluation(recent, 15, outputType, digitCount, targetPositions.length),
    l30: recentEvaluation(recent, 30, outputType, digitCount, targetPositions.length),
    l60: recentEvaluation(recent, 60, outputType, digitCount, targetPositions.length),
    rows: [...selected.rows, ...holdout.rows],
    liveDistributions,
    liveSelection,
  };
}
