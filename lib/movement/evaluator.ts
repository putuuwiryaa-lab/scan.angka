import type { Draw, Posisi } from "../engine/types";
import {
  evaluationOf,
  isCovered,
  targetDigitsOf,
  theoreticalBaseline,
} from "./helpers";
import {
  buildJointPairDistribution,
  buildMethodDistributions,
  buildPairMarkovDistribution,
} from "./models";
import {
  chooseJointPairDigits,
  chooseMovementDigits,
  jointPairProbabilities,
  movementProbabilities,
  type MovementSelection,
} from "./optimizer";
import {
  PAIR_MOVEMENT_METHODS,
  POSITION_MOVEMENT_METHODS,
  type MovementAuditRow,
  type MovementEvaluation,
  type MovementMethod,
  type MovementOutputType,
  type MovementProbability,
  type MovementTournamentCandidate,
  type PairMovementMethod,
} from "./types";

export const WALK_FORWARD_SIZE = 14 as const;
export const TRAINING_WINDOW_STEP = 14 as const;

interface PredictionResult {
  selection: MovementSelection;
  probabilities: MovementProbability[];
}

interface CandidateRun extends MovementTournamentCandidate {
  statuses: boolean[];
  rows: MovementAuditRow[];
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

function eligibleMethods(targetPositions: Posisi[]): MovementMethod[] {
  return targetPositions.length === 2
    ? [...POSITION_MOVEMENT_METHODS, ...PAIR_MOVEMENT_METHODS]
    : [...POSITION_MOVEMENT_METHODS];
}

function isPairMethod(method: MovementMethod): method is PairMovementMethod {
  return method === "joint_pair" || method === "pair_markov";
}

function predictWithMethod(
  trainingDraws: Draw[],
  method: MovementMethod,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): PredictionResult {
  if (isPairMethod(method)) {
    if (targetPositions.length !== 2) {
      throw new Error("Metode pasangan hanya tersedia untuk target dua posisi.");
    }
    const positions: [Posisi, Posisi] = [targetPositions[0], targetPositions[1]];
    const distribution = method === "pair_markov"
      ? buildPairMarkovDistribution(trainingDraws, positions)
      : buildJointPairDistribution(trainingDraws, positions);
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

function runCandidate(
  draws: Draw[],
  method: MovementMethod,
  window: number,
  targetPositions: Posisi[],
  outputType: MovementOutputType,
  digitCount: number,
): CandidateRun {
  const firstTargetIndex = draws.length - WALK_FORWARD_SIZE;
  const statuses: boolean[] = [];
  const rows: MovementAuditRow[] = [];
  let probabilityTotal = 0;

  for (let targetIndex = firstTargetIndex; targetIndex < draws.length; targetIndex += 1) {
    const trainingStart = targetIndex - window;
    if (trainingStart < 0) throw new Error(`Window ${window} tidak memiliki data training yang cukup.`);

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
    rows.push({
      targetIndex,
      targetDraw: draws[targetIndex],
      outputDigits: prediction.selection.digits,
      targetDigits,
      covered,
      phase: "walk_forward",
    });
  }

  const evaluation = evaluationOf(statuses, outputType, digitCount, targetPositions.length);
  return {
    method,
    window,
    evaluation,
    l7Hit: statuses.slice(-7).filter(Boolean).length,
    l3Hit: statuses.slice(-3).filter(Boolean).length,
    neighborAverageHit: 0,
    meanProbability: Number(((probabilityTotal / WALK_FORWARD_SIZE) * 100).toFixed(2)),
    statuses,
    rows,
  };
}

function withNeighborStability(candidates: CandidateRun[]): CandidateRun[] {
  const byKey = new Map(candidates.map((candidate) => [`${candidate.method}:${candidate.window}`, candidate]));
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
  const methods = eligibleMethods(targetPositions);
  const rawCandidates = methods.flatMap((method) =>
    windows.map((window) => runCandidate(
      draws,
      method,
      window,
      targetPositions,
      outputType,
      digitCount,
    )),
  );
  const ranked = rankCandidates(withNeighborStability(rawCandidates));
  const winner = ranked[0];
  if (!winner) throw new Error("Tidak ada metode dan window yang dapat diuji.");

  const requiredHits = minimumReleaseHits(outputType, digitCount, targetPositions.length);
  const released = winner.evaluation.hit >= requiredHits;
  const liveTraining = draws.slice(-winner.window);
  const live = predictWithMethod(
    liveTraining,
    winner.method,
    targetPositions,
    outputType,
    digitCount,
  );

  return {
    windows,
    candidateCount: ranked.length,
    selectedMethod: winner.method,
    selectedWindow: winner.window,
    minimumReleaseHits: requiredHits,
    released,
    evaluation: {
      l14: winner.evaluation,
      l7: recentEvaluation(winner.statuses, 7, outputType, digitCount, targetPositions.length),
      l3: recentEvaluation(winner.statuses, 3, outputType, digitCount, targetPositions.length),
    },
    tournament: ranked.slice(0, 12).map(({ statuses: _statuses, rows: _rows, ...candidate }) => candidate),
    rows: winner.rows,
    liveSelection: live.selection,
    liveProbabilities: live.probabilities,
  };
}
