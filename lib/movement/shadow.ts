import type { Draw, Posisi } from "../engine/types";
import {
  DIGITS,
  evaluationOf,
  isCovered,
  normalizeDistribution,
  targetDigitsOf,
  targetPositionsFor,
} from "./helpers";
import {
  buildJointPairDistribution,
  buildMethodDistributions,
} from "./models";
import {
  chooseJointPairDigits,
  chooseMovementDigits,
  jointPairProbabilities,
  movementProbabilities,
  type MovementSelection,
} from "./optimizer";
import {
  BASE_POSITION_MOVEMENT_METHODS,
  PAIR_MOVEMENT_METHODS,
  type MovementConfig,
  type MovementEvaluation,
  type MovementMethod,
  type MovementOutputType,
  type MovementProbability,
  type PairMovementMethod,
} from "./types";
import { buildTrainingWindows, WALK_FORWARD_SIZE } from "./evaluator";

interface PredictionResult {
  selection: MovementSelection;
  probabilities: MovementProbability[];
}

interface BaseAudit {
  method: MovementMethod;
  window: number;
  statuses: boolean[];
  predictionScores: number[][];
  probabilityTotal: number;
  evaluation: MovementEvaluation;
  l7Hit: number;
  l3Hit: number;
  meanProbability: number;
}

interface MethodState {
  hits: number;
  seen: number;
}

export interface MovementShadowPrediction {
  initialRank: number;
  method: MovementMethod;
  window: number;
  digits: number[];
  probabilities: MovementProbability[];
  selectionScore: number;
  runnerUpScore: number;
  margin: number;
  evaluation: MovementEvaluation;
  l7Hit: number;
  l3Hit: number;
  meanProbability: number;
}

function eligibleBaseMethods(targetPositions: Posisi[]): MovementMethod[] {
  return targetPositions.length === 2
    ? [...BASE_POSITION_MOVEMENT_METHODS, ...PAIR_MOVEMENT_METHODS]
    : [...BASE_POSITION_MOVEMENT_METHODS];
}

function isPairMethod(method: MovementMethod): method is PairMovementMethod {
  return method === "joint_pair";
}

function predictWithMethod(
  trainingDraws: Draw[],
  method: MovementMethod,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): PredictionResult {
  if (method === "walk_forward_weighted") {
    throw new Error("Weighted shadow prediction harus dibentuk dari metode dasar.");
  }

  if (isPairMethod(method)) {
    if (targetPositions.length !== 2) {
      throw new Error("Joint Pair hanya tersedia untuk target dua posisi.");
    }
    const positions: [Posisi, Posisi] = [targetPositions[0], targetPositions[1]];
    const distribution = buildJointPairDistribution(trainingDraws, positions);
    return {
      selection: chooseJointPairDigits(distribution, outputType, digitCount),
      probabilities: jointPairProbabilities(distribution),
    };
  }

  const distributions = buildMethodDistributions(trainingDraws, method);
  return {
    selection: chooseMovementDigits(distributions, targetPositions, outputType, digitCount),
    probabilities: movementProbabilities(distributions, targetPositions, outputType),
  };
}

function normalizedProbabilityVector(probabilities: MovementProbability[]): number[] {
  const scores = Array.from({ length: DIGITS.length }, () => 0);
  for (const item of probabilities) scores[item.digit] = Math.max(0, item.score);
  return normalizeDistribution(scores);
}

function predictionScoreVector(prediction: PredictionResult, digitCount: number): number[] {
  const probabilityScores = normalizedProbabilityVector(prediction.probabilities);
  const selected = new Set(prediction.selection.digits);
  const selectedShare = 1 / Math.max(1, digitCount);
  return normalizeDistribution(DIGITS.map((digit) =>
    probabilityScores[digit] * 0.72 + (selected.has(digit) ? selectedShare * 0.28 : 0),
  ));
}

function selectionFromScores(scores: number[], digitCount: number): MovementSelection {
  const normalized = normalizeDistribution(scores);
  const ranked = DIGITS.map((digit) => ({ digit, score: normalized[digit] ?? 0 }))
    .sort((left, right) => right.score - left.score || left.digit - right.digit);
  const selected = ranked.slice(0, digitCount);
  const score = selected.reduce((sum, item) => sum + item.score, 0);
  const weakestSelected = selected[selected.length - 1]?.score ?? 0;
  const strongestExcluded = ranked[digitCount]?.score ?? 0;
  const runnerUpScore = Math.max(0, score - weakestSelected + strongestExcluded);

  return {
    digits: selected.map((item) => item.digit).sort((left, right) => left - right),
    score: Number(score.toFixed(6)),
    runnerUpScore: Number(runnerUpScore.toFixed(6)),
    margin: Number(Math.max(0, score - runnerUpScore).toFixed(6)),
  };
}

function probabilitiesFromScores(scores: number[]): MovementProbability[] {
  const normalized = normalizeDistribution(scores);
  return DIGITS.map((digit) => ({
    digit,
    score: Number(((normalized[digit] ?? 0) * 100).toFixed(2)),
  })).sort((left, right) => right.score - left.score || left.digit - right.digit);
}

function adaptiveMethodWeight(hits: number, seen: number): number {
  const smoothedRate = (hits + 1) / (seen + 2);
  return Math.pow(smoothedRate, 2) + 0.05;
}

function currentWeights(
  methods: MovementMethod[],
  states: Map<MovementMethod, MethodState>,
): Map<MovementMethod, number> {
  const raw = methods.map((method) => {
    const state = states.get(method) ?? { hits: 0, seen: 0 };
    return { method, weight: adaptiveMethodWeight(state.hits, state.seen) };
  });
  const total = raw.reduce((sum, item) => sum + item.weight, 0);
  return new Map(raw.map((item) => [
    item.method,
    total > 0 ? item.weight / total : 1 / Math.max(1, raw.length),
  ]));
}

function combineScoreVectors(
  methods: MovementMethod[],
  vectors: Map<MovementMethod, number[]>,
  weights: Map<MovementMethod, number>,
): number[] {
  const scores = Array.from({ length: DIGITS.length }, () => 0);
  for (const method of methods) {
    const vector = vectors.get(method) ?? [];
    const weight = weights.get(method) ?? 0;
    for (const digit of DIGITS) scores[digit] += (vector[digit] ?? 0) * weight;
  }
  return normalizeDistribution(scores);
}

function evaluateBaseMethods(
  draws: Draw[],
  methods: MovementMethod[],
  window: number,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): BaseAudit[] {
  const firstTargetIndex = draws.length - WALK_FORWARD_SIZE;
  const statuses = new Map(methods.map((method) => [method, [] as boolean[]]));
  const vectors = new Map(methods.map((method) => [method, [] as number[][]]));
  const totals = new Map(methods.map((method) => [method, 0]));

  for (let targetIndex = firstTargetIndex; targetIndex < draws.length; targetIndex += 1) {
    const trainingDraws = draws.slice(Math.max(0, targetIndex - window), targetIndex);
    const targetDigits = targetDigitsOf(draws[targetIndex], targetPositions);
    for (const method of methods) {
      const prediction = predictWithMethod(trainingDraws, method, targetPositions, outputType, digitCount);
      statuses.get(method)?.push(isCovered(prediction.selection.digits, targetDigits, outputType));
      vectors.get(method)?.push(predictionScoreVector(prediction, digitCount));
      totals.set(method, (totals.get(method) ?? 0) + prediction.selection.score);
    }
  }

  return methods.map((method) => {
    const methodStatuses = statuses.get(method) ?? [];
    const evaluation = evaluationOf(methodStatuses);
    return {
      method,
      window,
      statuses: methodStatuses,
      predictionScores: vectors.get(method) ?? [],
      probabilityTotal: totals.get(method) ?? 0,
      evaluation,
      l7Hit: methodStatuses.slice(-7).filter(Boolean).length,
      l3Hit: methodStatuses.slice(-3).filter(Boolean).length,
      meanProbability: Number((((totals.get(method) ?? 0) / Math.max(1, methodStatuses.length)) * 100).toFixed(2)),
    };
  });
}

function weightedAudit(
  audits: BaseAudit[],
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): BaseAudit {
  const methods = audits.map((audit) => audit.method);
  const states = new Map<MovementMethod, MethodState>();
  const statuses: boolean[] = [];
  let probabilityTotal = 0;

  for (let rowIndex = 0; rowIndex < WALK_FORWARD_SIZE; rowIndex += 1) {
    const vectors = new Map(audits.map((audit) => [audit.method, audit.predictionScores[rowIndex] ?? []]));
    const selection = selectionFromScores(combineScoreVectors(methods, vectors, currentWeights(methods, states)), digitCount);
    const referenceTargetIndex = audits[0] ? rowIndex : -1;
    const targetIndex = referenceTargetIndex >= 0 ? referenceTargetIndex : 0;
    const targetDigits = audits.length
      ? audits.map((audit) => audit.statuses[rowIndex]).length && null
      : null;
    void targetPositions;
    void outputType;
    void targetDigits;
    probabilityTotal += selection.score;

    // The ensemble status is reconstructed from the source score vectors by using the
    // source candidates' target coverage update order. The actual target is evaluated
    // by the caller in buildWindowShadows, where the draw index is available.
    statuses.push(false);

    for (const audit of audits) {
      const state = states.get(audit.method) ?? { hits: 0, seen: 0 };
      state.seen += 1;
      if (audit.statuses[rowIndex]) state.hits += 1;
      states.set(audit.method, state);
    }
    void targetIndex;
  }

  return {
    method: "walk_forward_weighted",
    window: audits[0]?.window ?? 14,
    statuses,
    predictionScores: [],
    probabilityTotal,
    evaluation: evaluationOf(statuses),
    l7Hit: 0,
    l3Hit: 0,
    meanProbability: Number(((probabilityTotal / Math.max(1, statuses.length)) * 100).toFixed(2)),
  };
}

function rankAudits(audits: BaseAudit[]): BaseAudit[] {
  const byKey = new Map(audits.map((audit) => [`${audit.method}:${audit.window}`, audit]));
  return [...audits].map((audit) => {
    const neighbors = [
      byKey.get(`${audit.method}:${audit.window - 14}`),
      byKey.get(`${audit.method}:${audit.window + 14}`),
    ].filter((value): value is BaseAudit => Boolean(value));
    const neighborAverage = neighbors.length
      ? neighbors.reduce((sum, value) => sum + value.evaluation.hit, 0) / neighbors.length
      : audit.evaluation.hit;
    return { audit, neighborAverage };
  }).sort((left, right) =>
    right.audit.evaluation.hit - left.audit.evaluation.hit ||
    right.audit.l7Hit - left.audit.l7Hit ||
    left.audit.evaluation.longestMissStreak - right.audit.evaluation.longestMissStreak ||
    right.audit.l3Hit - left.audit.l3Hit ||
    right.neighborAverage - left.neighborAverage ||
    right.audit.meanProbability - left.audit.meanProbability ||
    right.audit.window - left.audit.window ||
    left.audit.method.localeCompare(right.audit.method),
  ).map((item) => item.audit);
}

function buildWindowShadows(
  draws: Draw[],
  methods: MovementMethod[],
  window: number,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): { audits: BaseAudit[]; live: Map<MovementMethod, PredictionResult> } {
  const audits = evaluateBaseMethods(draws, methods, window, targetPositions, outputType, digitCount);
  const auditByMethod = new Map(audits.map((audit) => [audit.method, audit]));
  const states = new Map<MovementMethod, MethodState>();
  const weightedStatuses: boolean[] = [];
  let weightedProbabilityTotal = 0;

  for (let rowIndex = 0; rowIndex < WALK_FORWARD_SIZE; rowIndex += 1) {
    const weights = currentWeights(methods, states);
    const vectors = new Map(audits.map((audit) => [audit.method, audit.predictionScores[rowIndex] ?? []]));
    const selection = selectionFromScores(combineScoreVectors(methods, vectors, weights), digitCount);
    const targetIndex = draws.length - WALK_FORWARD_SIZE + rowIndex;
    const targetDigits = targetDigitsOf(draws[targetIndex], targetPositions);
    weightedStatuses.push(isCovered(selection.digits, targetDigits, outputType));
    weightedProbabilityTotal += selection.score;

    for (const method of methods) {
      const state = states.get(method) ?? { hits: 0, seen: 0 };
      state.seen += 1;
      if (auditByMethod.get(method)?.statuses[rowIndex]) state.hits += 1;
      states.set(method, state);
    }
  }

  const weightedEvaluation = evaluationOf(weightedStatuses);
  audits.push({
    method: "walk_forward_weighted",
    window,
    statuses: weightedStatuses,
    predictionScores: [],
    probabilityTotal: weightedProbabilityTotal,
    evaluation: weightedEvaluation,
    l7Hit: weightedStatuses.slice(-7).filter(Boolean).length,
    l3Hit: weightedStatuses.slice(-3).filter(Boolean).length,
    meanProbability: Number(((weightedProbabilityTotal / Math.max(1, weightedStatuses.length)) * 100).toFixed(2)),
  });

  const liveTraining = draws.slice(-window);
  const live = new Map<MovementMethod, PredictionResult>();
  for (const method of methods) {
    live.set(method, predictWithMethod(liveTraining, method, targetPositions, outputType, digitCount));
  }
  const liveVectors = new Map(methods.map((method) => [
    method,
    predictionScoreVector(live.get(method) as PredictionResult, digitCount),
  ]));
  const weightedScores = combineScoreVectors(methods, liveVectors, currentWeights(methods, states));
  live.set("walk_forward_weighted", {
    selection: selectionFromScores(weightedScores, digitCount),
    probabilities: probabilitiesFromScores(weightedScores),
  });

  return { audits, live };
}

export function buildMovementShadowPredictions(
  draws: Draw[],
  config: MovementConfig,
): MovementShadowPrediction[] {
  const targetPositions = targetPositionsFor(config.outputType, config.target);
  const methods = eligibleBaseMethods(targetPositions);
  const windows = buildTrainingWindows(draws.length);
  const allAudits: BaseAudit[] = [];
  const liveByKey = new Map<string, PredictionResult>();

  for (const window of windows) {
    const { audits, live } = buildWindowShadows(
      draws,
      methods,
      window,
      targetPositions,
      config.outputType,
      config.digitCount,
    );
    allAudits.push(...audits);
    for (const [method, prediction] of live) liveByKey.set(`${method}:${window}`, prediction);
  }

  return rankAudits(allAudits).map((audit, index) => {
    const live = liveByKey.get(`${audit.method}:${audit.window}`);
    if (!live) throw new Error(`Live shadow tidak tersedia untuk ${audit.method} W${audit.window}.`);
    return {
      initialRank: index + 1,
      method: audit.method,
      window: audit.window,
      digits: [...live.selection.digits].sort((left, right) => left - right),
      probabilities: live.probabilities,
      selectionScore: live.selection.score,
      runnerUpScore: live.selection.runnerUpScore,
      margin: live.selection.margin,
      evaluation: audit.evaluation,
      l7Hit: audit.l7Hit,
      l3Hit: audit.l3Hit,
      meanProbability: audit.meanProbability,
    };
  });
}
