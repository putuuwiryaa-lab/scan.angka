import type { Draw, Posisi } from "../engine/types";
import {
  DIGITS,
  evaluationOf,
  isCovered,
  targetDigitsOf,
  theoreticalBaseline,
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
  type MovementAuditRow,
  type MovementEvaluation,
  type MovementMethod,
  type MovementOutputType,
  type MovementProbability,
  type MovementTieBreakRound,
  type MovementTieBreakStatus,
  type MovementTournamentCandidate,
  type PairMovementMethod,
} from "./types";

export const WALK_FORWARD_SIZE = 14 as const;
export const TRAINING_WINDOW_STEP = 14 as const;
export const TIE_BREAK_STEP = 7 as const;

interface PredictionResult {
  selection: MovementSelection;
  probabilities: MovementProbability[];
}

interface EnsembleMethodWeight {
  method: MovementMethod;
  weight: number;
}

interface CandidateRun extends MovementTournamentCandidate {
  statuses: boolean[];
  rows: MovementAuditRow[];
  probabilityTotal: number;
  predictionScores: number[][];
  ensembleSources?: CandidateRun[];
  ensembleWeights?: EnsembleMethodWeight[];
}

interface CandidateRangeResult {
  statuses: boolean[];
  rows: MovementAuditRow[];
  probabilityTotal: number;
  predictionScores: number[][];
}

interface CandidateInternals {
  predictionScores: number[][];
  ensembleSources?: CandidateRun[];
  ensembleWeights?: EnsembleMethodWeight[];
}

interface TieResolution {
  finalists: CandidateRun[];
  rankedCandidates: CandidateRun[];
  selectedSize: number;
  initialCandidateCount: number;
  status: MovementTieBreakStatus;
  rounds: MovementTieBreakRound[];
}

export interface MovementTournamentResult {
  windows: number[];
  candidateCount: number;
  selectedMethod: MovementMethod;
  selectedWindow: number;
  minimumReleaseHits: number;
  released: boolean;
  evaluation: {
    l14: MovementEvaluation;
    l7: MovementEvaluation;
    l3: MovementEvaluation;
  };
  selectionValidation: MovementEvaluation;
  tieBreakStatus: MovementTieBreakStatus;
  tieBreakInitialCandidateCount: number;
  tieBreakRounds: MovementTieBreakRound[];
  tournament: MovementTournamentCandidate[];
  rows: MovementAuditRow[];
  liveSelection: MovementSelection;
  liveProbabilities: MovementProbability[];
}

export function buildTrainingWindows(totalData: number): number[] {
  const maximumWindow = totalData - WALK_FORWARD_SIZE;
  if (maximumWindow < TRAINING_WINDOW_STEP) {
    throw new Error("Data belum cukup. Movement Engine membutuhkan minimal 28 result.");
  }

  const windows: number[] = [];
  for (let window = TRAINING_WINDOW_STEP; window <= maximumWindow; window += TRAINING_WINDOW_STEP) {
    windows.push(window);
  }
  return windows;
}

function eligibleBaseMethods(targetPositions: Posisi[]): MovementMethod[] {
  return targetPositions.length === 2
    ? [...BASE_POSITION_MOVEMENT_METHODS, ...PAIR_MOVEMENT_METHODS]
    : [...BASE_POSITION_MOVEMENT_METHODS];
}

function isPairMethod(method: MovementMethod): method is PairMovementMethod {
  return method === "joint_pair";
}

function candidateKey(candidate: Pick<MovementTournamentCandidate, "method" | "window">): string {
  return `${candidate.method}:${candidate.window}`;
}

function normalizeScoreVector(scores: number[]): number[] {
  const positive = DIGITS.map((digit) => Math.max(0, scores[digit] ?? 0));
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return DIGITS.map(() => 1 / DIGITS.length);
  return positive.map((value) => value / total);
}

function predictionScoreVector(prediction: PredictionResult, digitCount: number): number[] {
  const probabilityScores = Array.from({ length: DIGITS.length }, () => 0);
  for (const item of prediction.probabilities) probabilityScores[item.digit] = Math.max(0, item.score);
  const normalizedProbabilities = normalizeScoreVector(probabilityScores);
  const selected = new Set(prediction.selection.digits);
  const selectedShare = 1 / Math.max(1, digitCount);

  return normalizeScoreVector(DIGITS.map((digit) =>
    normalizedProbabilities[digit] * 0.72 + (selected.has(digit) ? selectedShare * 0.28 : 0),
  ));
}

function selectionFromScores(scores: number[], digitCount: number): MovementSelection {
  const normalized = normalizeScoreVector(scores);
  const ranked = DIGITS.map((digit) => ({ digit, score: normalized[digit] }))
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
  const normalized = normalizeScoreVector(scores);
  return DIGITS.map((digit) => ({
    digit,
    score: Number((normalized[digit] * 100).toFixed(2)),
  })).sort((left, right) => right.score - left.score || left.digit - right.digit);
}

function predictWithMethod(
  trainingDraws: Draw[],
  method: MovementMethod,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): PredictionResult {
  if (method === "walk_forward_weighted") {
    throw new Error("Walk-Forward Weighted Ensemble dibentuk dari hasil metode dasar.");
  }

  if (isPairMethod(method)) {
    if (targetPositions.length !== 2) {
      throw new Error("Metode pasangan hanya tersedia untuk target dua posisi.");
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

function recentEvaluation(
  statuses: boolean[],
  size: number,
  outputType: MovementOutputType,
  digitCount: number,
  targetPositionCount: number,
): MovementEvaluation {
  return evaluationOf(
    statuses.slice(-Math.min(size, statuses.length)),
    outputType,
    digitCount,
    targetPositionCount,
  );
}

function evaluateCandidateRange(
  draws: Draw[],
  method: MovementMethod,
  window: number,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
  firstTargetIndex: number,
  endTargetIndex: number,
): CandidateRangeResult {
  const statuses: boolean[] = [];
  const rows: MovementAuditRow[] = [];
  const predictionScores: number[][] = [];
  let probabilityTotal = 0;

  for (let targetIndex = firstTargetIndex; targetIndex < endTargetIndex; targetIndex += 1) {
    const trainingStart = Math.max(0, targetIndex - window);
    const trainingDraws = draws.slice(trainingStart, targetIndex);
    const prediction = predictWithMethod(
      trainingDraws,
      method,
      targetPositions,
      outputType,
      digitCount,
    );
    const targetDigits = targetDigitsOf(draws[targetIndex], targetPositions);
    const covered = isCovered(prediction.selection.digits, targetDigits, outputType);

    statuses.push(covered);
    probabilityTotal += prediction.selection.score;
    predictionScores.push(predictionScoreVector(prediction, digitCount));
    rows.push({
      targetIndex,
      targetDraw: draws[targetIndex],
      outputDigits: prediction.selection.digits,
      targetDigits,
      covered,
      phase: "walk_forward",
    });
  }

  return { statuses, rows, probabilityTotal, predictionScores };
}

function candidateFromAudit(
  method: MovementMethod,
  window: number,
  statuses: boolean[],
  rows: MovementAuditRow[],
  probabilityTotal: number,
  outputType: MovementOutputType,
  digitCount: number,
  targetPositionCount: number,
  internals: CandidateInternals,
): CandidateRun {
  const evaluation = evaluationOf(statuses, outputType, digitCount, targetPositionCount);
  return {
    method,
    window,
    evaluation,
    l7Hit: statuses.slice(-7).filter(Boolean).length,
    l3Hit: statuses.slice(-3).filter(Boolean).length,
    neighborAverageHit: 0,
    meanProbability: Number(((probabilityTotal / statuses.length) * 100).toFixed(2)),
    statuses,
    rows,
    probabilityTotal,
    predictionScores: internals.predictionScores,
    ensembleSources: internals.ensembleSources,
    ensembleWeights: internals.ensembleWeights,
  };
}

function runCandidate(
  draws: Draw[],
  method: MovementMethod,
  window: number,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
  walkForwardSize: number = WALK_FORWARD_SIZE,
): CandidateRun {
  const firstTargetIndex = draws.length - walkForwardSize;
  if (firstTargetIndex < TRAINING_WINDOW_STEP) {
    throw new Error(`Walk-forward L${walkForwardSize} menyisakan data training kurang dari ${TRAINING_WINDOW_STEP} result.`);
  }

  const audit = evaluateCandidateRange(
    draws,
    method,
    window,
    targetPositions,
    outputType,
    digitCount,
    firstTargetIndex,
    draws.length,
  );
  return candidateFromAudit(
    method,
    window,
    audit.statuses,
    audit.rows,
    audit.probabilityTotal,
    outputType,
    digitCount,
    targetPositions.length,
    { predictionScores: audit.predictionScores },
  );
}

function adaptiveMethodWeight(hits: number, seen: number): number {
  const smoothedRate = (hits + 1) / (seen + 2);
  return Math.pow(smoothedRate, 2) + 0.05;
}

function currentEnsembleWeights(
  sources: CandidateRun[],
  states: Map<MovementMethod, { hits: number; seen: number }>,
): EnsembleMethodWeight[] {
  const raw = sources.map((source) => {
    const state = states.get(source.method) ?? { hits: 0, seen: 0 };
    return { method: source.method, weight: adaptiveMethodWeight(state.hits, state.seen) };
  });
  const total = raw.reduce((sum, item) => sum + item.weight, 0);
  return raw.map((item) => ({
    method: item.method,
    weight: total > 0 ? item.weight / total : 1 / Math.max(1, raw.length),
  }));
}

function combineSourceScores(
  sources: CandidateRun[],
  rowIndex: number,
  weights: EnsembleMethodWeight[],
): number[] {
  const weightByMethod = new Map(weights.map((item) => [item.method, item.weight]));
  const scores = Array.from({ length: DIGITS.length }, () => 0);

  for (const source of sources) {
    const weight = weightByMethod.get(source.method) ?? 0;
    const sourceScores = source.predictionScores[rowIndex] ?? [];
    for (const digit of DIGITS) scores[digit] += (sourceScores[digit] ?? 0) * weight;
  }
  return normalizeScoreVector(scores);
}

function buildWeightedCandidate(
  sources: CandidateRun[],
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): CandidateRun {
  if (!sources.length) throw new Error("Tidak ada metode dasar untuk Walk-Forward Weighted Ensemble.");

  const orderedSources = [...sources].sort((left, right) => left.method.localeCompare(right.method));
  const rowCount = orderedSources[0].rows.length;
  if (!orderedSources.every((source) => source.rows.length === rowCount)) {
    throw new Error("Audit metode dasar tidak sejajar untuk Walk-Forward Weighted Ensemble.");
  }

  const states = new Map<MovementMethod, { hits: number; seen: number }>();
  const statuses: boolean[] = [];
  const rows: MovementAuditRow[] = [];
  const predictionScores: number[][] = [];
  let probabilityTotal = 0;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const weights = currentEnsembleWeights(orderedSources, states);
    const combinedScores = combineSourceScores(orderedSources, rowIndex, weights);
    const selection = selectionFromScores(combinedScores, digitCount);
    const reference = orderedSources[0].rows[rowIndex];
    const covered = isCovered(selection.digits, reference.targetDigits, outputType);

    statuses.push(covered);
    probabilityTotal += selection.score;
    predictionScores.push(combinedScores);
    rows.push({
      targetIndex: reference.targetIndex,
      targetDraw: reference.targetDraw,
      outputDigits: selection.digits,
      targetDigits: reference.targetDigits,
      covered,
      phase: "walk_forward",
    });

    for (const source of orderedSources) {
      const state = states.get(source.method) ?? { hits: 0, seen: 0 };
      state.seen += 1;
      if (source.rows[rowIndex].covered) state.hits += 1;
      states.set(source.method, state);
    }
  }

  return candidateFromAudit(
    "walk_forward_weighted",
    orderedSources[0].window,
    statuses,
    rows,
    probabilityTotal,
    outputType,
    digitCount,
    targetPositions.length,
    {
      predictionScores,
      ensembleSources: orderedSources,
      ensembleWeights: currentEnsembleWeights(orderedSources, states),
    },
  );
}

function extendCandidate(
  draws: Draw[],
  candidate: CandidateRun,
  nextSize: number,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): CandidateRun {
  const currentSize = candidate.statuses.length;
  if (nextSize <= currentSize) return candidate;

  const firstTargetIndex = draws.length - nextSize;
  if (firstTargetIndex < TRAINING_WINDOW_STEP) {
    throw new Error(`Walk-forward L${nextSize} menyisakan data training kurang dari ${TRAINING_WINDOW_STEP} result.`);
  }

  if (candidate.method === "walk_forward_weighted") {
    if (!candidate.ensembleSources?.length) {
      throw new Error("Sumber Walk-Forward Weighted Ensemble tidak tersedia.");
    }
    const extendedSources = candidate.ensembleSources.map((source) => extendCandidate(
      draws,
      source,
      nextSize,
      targetPositions,
      outputType,
      digitCount,
    ));
    return buildWeightedCandidate(extendedSources, targetPositions, outputType, digitCount);
  }

  const addedAudit = evaluateCandidateRange(
    draws,
    candidate.method,
    candidate.window,
    targetPositions,
    outputType,
    digitCount,
    firstTargetIndex,
    draws.length - currentSize,
  );
  return candidateFromAudit(
    candidate.method,
    candidate.window,
    [...addedAudit.statuses, ...candidate.statuses],
    [...addedAudit.rows, ...candidate.rows],
    addedAudit.probabilityTotal + candidate.probabilityTotal,
    outputType,
    digitCount,
    targetPositions.length,
    {
      predictionScores: [...addedAudit.predictionScores, ...candidate.predictionScores],
    },
  );
}

function withNeighborStability(candidates: CandidateRun[]): CandidateRun[] {
  const byKey = new Map(candidates.map((candidate) => [candidateKey(candidate), candidate]));
  return candidates.map((candidate) => {
    const neighbors = [
      byKey.get(`${candidate.method}:${candidate.window - TRAINING_WINDOW_STEP}`),
      byKey.get(`${candidate.method}:${candidate.window + TRAINING_WINDOW_STEP}`),
    ].filter((value): value is CandidateRun => Boolean(value));
    const neighborAverageHit = neighbors.length
      ? Number((neighbors.reduce((sum, value) => sum + value.evaluation.hit, 0) / neighbors.length).toFixed(2))
      : candidate.evaluation.hit;
    return { ...candidate, neighborAverageHit };
  });
}

function rankCandidates(candidates: CandidateRun[]): CandidateRun[] {
  return [...candidates].sort((left, right) =>
    right.evaluation.hit - left.evaluation.hit ||
    right.l7Hit - left.l7Hit ||
    left.evaluation.longestMissStreak - right.evaluation.longestMissStreak ||
    right.l3Hit - left.l3Hit ||
    right.neighborAverageHit - left.neighborAverageHit ||
    right.meanProbability - left.meanProbability ||
    right.window - left.window ||
    left.method.localeCompare(right.method),
  );
}

function highestHitCandidates(candidates: CandidateRun[]): CandidateRun[] {
  const highestHit = Math.max(...candidates.map((candidate) => candidate.evaluation.hit));
  return candidates.filter((candidate) => candidate.evaluation.hit === highestHit);
}

function canEvaluateSize(totalData: number, walkForwardSize: number): boolean {
  return totalData - walkForwardSize >= TRAINING_WINDOW_STEP;
}

function resolveHitTie(
  draws: Draw[],
  candidates: CandidateRun[],
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): TieResolution {
  let rankedCandidates = rankCandidates(candidates);
  let finalists = highestHitCandidates(rankedCandidates);
  const initialCandidateCount = finalists.length;
  let selectedSize: number = WALK_FORWARD_SIZE;
  const rounds: MovementTieBreakRound[] = [];

  while (finalists.length > 1) {
    const nextSize = selectedSize + TIE_BREAK_STEP;
    if (!canEvaluateSize(draws.length, nextSize)) break;

    const extended = rankedCandidates.map((candidate) => extendCandidate(
      draws,
      candidate,
      nextSize,
      targetPositions,
      outputType,
      digitCount,
    ));
    rankedCandidates = rankCandidates(withNeighborStability(extended));
    const nextFinalists = highestHitCandidates(rankedCandidates);
    const bestHit = nextFinalists[0]?.evaluation.hit ?? 0;
    const roundCandidates = rankedCandidates.map((candidate) => ({
      method: candidate.method,
      window: candidate.window,
      evaluation: candidate.evaluation,
    }));

    rounds.push({
      size: nextSize,
      candidateCount: rankedCandidates.length,
      bestHit,
      remainingCandidateCount: nextFinalists.length,
      candidates: roundCandidates,
    });
    finalists = nextFinalists;
    selectedSize = nextSize;
  }

  const status: MovementTieBreakStatus = initialCandidateCount <= 1
    ? "not_needed"
    : finalists.length === 1
      ? "resolved"
      : "history_limit";

  return {
    finalists,
    rankedCandidates,
    selectedSize,
    initialCandidateCount,
    status,
    rounds,
  };
}

function weightedLivePrediction(
  trainingDraws: Draw[],
  candidate: CandidateRun,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): PredictionResult {
  const sourceMethods = [...new Set(candidate.ensembleSources?.map((source) => source.method) ?? [])];
  if (!sourceMethods.length) throw new Error("Sumber live Walk-Forward Weighted Ensemble tidak tersedia.");

  const storedWeights = new Map(candidate.ensembleWeights?.map((item) => [item.method, item.weight]) ?? []);
  const rawWeights = sourceMethods.map((method) => storedWeights.get(method) ?? 1);
  const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0);
  const scores = Array.from({ length: DIGITS.length }, () => 0);

  sourceMethods.forEach((method, index) => {
    const prediction = predictWithMethod(trainingDraws, method, targetPositions, outputType, digitCount);
    const sourceScores = predictionScoreVector(prediction, digitCount);
    const weight = weightTotal > 0 ? rawWeights[index] / weightTotal : 1 / sourceMethods.length;
    for (const digit of DIGITS) scores[digit] += sourceScores[digit] * weight;
  });

  const normalized = normalizeScoreVector(scores);
  return {
    selection: selectionFromScores(normalized, digitCount),
    probabilities: probabilitiesFromScores(normalized),
  };
}

export function minimumReleaseHits(
  outputType: MovementOutputType,
  digitCount: number,
  targetPositionCount: number,
): number {
  const baseline = theoreticalBaseline(outputType, digitCount, targetPositionCount);
  const expectedHits = baseline / 100 * WALK_FORWARD_SIZE;
  return Math.min(WALK_FORWARD_SIZE, Math.ceil(expectedHits) + 1);
}

export function evaluateMovementTournament(
  draws: Draw[],
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): MovementTournamentResult {
  const windows = buildTrainingWindows(draws.length);
  const baseMethods = eligibleBaseMethods(targetPositions);
  const baseCandidates = baseMethods.flatMap((method) =>
    windows.map((window) => runCandidate(
      draws,
      method,
      window,
      targetPositions,
      outputType,
      digitCount,
    )),
  );
  const weightedCandidates = windows.map((window) => buildWeightedCandidate(
    baseCandidates.filter((candidate) => candidate.window === window),
    targetPositions,
    outputType,
    digitCount,
  ));
  const rawCandidates = [...baseCandidates, ...weightedCandidates];
  const baseRanked = rankCandidates(withNeighborStability(rawCandidates));
  const tieResolution = resolveHitTie(
    draws,
    baseRanked,
    targetPositions,
    outputType,
    digitCount,
  );
  const decisionRanked = tieResolution.rankedCandidates;
  const selectionCandidate = decisionRanked[0];
  if (!selectionCandidate) throw new Error("Tidak ada metode dan window yang dapat diuji.");

  const baseByKey = new Map(baseRanked.map((candidate) => [candidateKey(candidate), candidate]));
  const baseWinner = baseByKey.get(candidateKey(selectionCandidate)) ?? selectionCandidate;
  const displayRanked = decisionRanked.map((candidate) => baseByKey.get(candidateKey(candidate)) ?? candidate);
  const requiredHits = minimumReleaseHits(outputType, digitCount, targetPositions.length);
  const released = baseWinner.evaluation.hit >= requiredHits;
  const liveTraining = draws.slice(-selectionCandidate.window);
  const live = selectionCandidate.method === "walk_forward_weighted"
    ? weightedLivePrediction(liveTraining, selectionCandidate, targetPositions, outputType, digitCount)
    : predictWithMethod(liveTraining, selectionCandidate.method, targetPositions, outputType, digitCount);

  return {
    windows,
    candidateCount: displayRanked.length,
    selectedMethod: selectionCandidate.method,
    selectedWindow: selectionCandidate.window,
    minimumReleaseHits: requiredHits,
    released,
    evaluation: {
      l14: baseWinner.evaluation,
      l7: recentEvaluation(baseWinner.statuses, 7, outputType, digitCount, targetPositions.length),
      l3: recentEvaluation(baseWinner.statuses, 3, outputType, digitCount, targetPositions.length),
    },
    selectionValidation: selectionCandidate.evaluation,
    tieBreakStatus: tieResolution.status,
    tieBreakInitialCandidateCount: tieResolution.initialCandidateCount,
    tieBreakRounds: tieResolution.rounds,
    tournament: displayRanked.slice(0, 12).map(({
      statuses: _statuses,
      rows: _rows,
      probabilityTotal: _probabilityTotal,
      predictionScores: _predictionScores,
      ensembleSources: _ensembleSources,
      ensembleWeights: _ensembleWeights,
      ...candidate
    }) => candidate),
    rows: selectionCandidate.rows,
    liveSelection: live.selection,
    liveProbabilities: live.probabilities,
  };
}
