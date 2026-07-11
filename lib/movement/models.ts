import type { Draw, Posisi } from "../engine/types";
import {
  DIGITS,
  POSITIONS,
  digitAt,
  modularDelta,
  normalizeDistribution,
  signedDelta,
} from "./helpers";
import type {
  DigitDistribution,
  MovementModel,
  MovementWeights,
  PositionDistributions,
} from "./types";

export type ComponentDistributions = Record<MovementModel, PositionDistributions>;

function blankScores(smoothing = 0.35): number[] {
  return DIGITS.map(() => smoothing);
}

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 10 - distance);
}

function positionValues(draws: Draw[], position: Posisi): number[] {
  return draws.map((draw) => digitAt(draw, position));
}

function transitionDistribution(draws: Draw[], position: Posisi): DigitDistribution {
  const values = positionValues(draws, position);
  if (values.length < 3) return normalizeDistribution(blankScores());

  const scores = blankScores(0.45);
  const lastIndex = values.length - 1;
  const liveCurrent = values[lastIndex];
  const livePrevious = values[lastIndex - 1];
  const liveDelta = modularDelta(livePrevious, liveCurrent);
  const livePreviousDelta = lastIndex >= 2
    ? modularDelta(values[lastIndex - 2], livePrevious)
    : liveDelta;

  for (let targetIndex = 2; targetIndex < values.length; targetIndex += 1) {
    const current = values[targetIndex - 1];
    const previous = values[targetIndex - 2];
    const next = values[targetIndex];
    const delta = modularDelta(previous, current);
    const previousDelta = targetIndex >= 3
      ? modularDelta(values[targetIndex - 3], previous)
      : delta;
    const age = values.length - 1 - targetIndex;
    const decay = Math.pow(0.996, age);

    let weight = 0.12;
    if (current === liveCurrent) weight += 0.9;
    if (delta === liveDelta) weight += 1.15;
    if (current === liveCurrent && delta === liveDelta) weight += 2.1;
    if (delta === liveDelta && previousDelta === livePreviousDelta) weight += 1.35;
    scores[next] += weight * decay;
  }

  return normalizeDistribution(scores);
}

function motifDistribution(draws: Draw[], position: Posisi): DigitDistribution {
  const values = positionValues(draws, position);
  if (values.length < 8) return transitionDistribution(draws, position);

  const deltas = values.slice(1).map((value, index) => signedDelta(values[index], value));
  const patternLength = Math.min(5, Math.max(3, Math.floor(deltas.length / 18)));
  const livePattern = deltas.slice(-patternLength);
  const matches: Array<{ nextDigit: number; similarity: number }> = [];

  for (let anchor = patternLength; anchor <= values.length - 2; anchor += 1) {
    const pattern = deltas.slice(anchor - patternLength, anchor);
    if (pattern.length !== livePattern.length) continue;

    let distance = 0;
    let directionMatches = 0;
    for (let index = 0; index < patternLength; index += 1) {
      const historical = pattern[index];
      const live = livePattern[index];
      distance += Math.abs(historical - live) / 5;
      if (Math.sign(historical) === Math.sign(live)) directionMatches += 1;
    }

    const averageDistance = distance / patternLength;
    const directionShare = directionMatches / patternLength;
    const age = values.length - 2 - anchor;
    const recency = Math.pow(0.997, age);
    const similarity = Math.exp(-averageDistance * 1.8) * (0.55 + 0.45 * directionShare) * recency;
    matches.push({ nextDigit: values[anchor + 1], similarity });
  }

  const scores = blankScores(0.25);
  for (const match of matches.sort((left, right) => right.similarity - left.similarity).slice(0, 36)) {
    scores[match.nextDigit] += match.similarity;
  }
  return normalizeDistribution(scores);
}

function cycleDistribution(draws: Draw[], position: Posisi): DigitDistribution {
  const values = positionValues(draws, position);
  const scores = blankScores(0.3);
  const currentIndex = values.length - 1;
  const recent = values.slice(-40);

  for (const digit of DIGITS) {
    const occurrences: number[] = [];
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] === digit) occurrences.push(index);
    }

    const recentFrequency = recent.filter((value) => value === digit).length / Math.max(1, recent.length);
    if (!occurrences.length) {
      scores[digit] += 0.8 + recentFrequency;
      continue;
    }

    const currentGap = currentIndex - occurrences[occurrences.length - 1];
    const gaps = occurrences.slice(1).map((index, gapIndex) => index - occurrences[gapIndex]);
    const recentGaps = gaps.slice(-6);
    const averageGap = recentGaps.length
      ? recentGaps.reduce((sum, gap) => sum + gap, 0) / recentGaps.length
      : Math.max(1, values.length / occurrences.length);
    const rhythm = 1 / (1 + Math.abs(currentGap - averageGap));
    const pressure = Math.min(1.8, currentGap / Math.max(1, averageGap));
    const consistency = recentGaps.length >= 2
      ? 1 / (1 + Math.max(...recentGaps) - Math.min(...recentGaps))
      : 0.25;

    scores[digit] += rhythm * 1.5 + pressure * 0.55 + consistency * 0.45 + recentFrequency * 2;
  }

  return normalizeDistribution(scores);
}

function crossDistribution(draws: Draw[], targetPosition: Posisi): DigitDistribution {
  if (draws.length < 4) return transitionDistribution(draws, targetPosition);

  const scores = blankScores(0.3);
  const latest = draws[draws.length - 1];
  const previous = draws[draws.length - 2];
  const liveDigits = POSITIONS.map((position) => digitAt(latest, position));
  const liveDeltas = POSITIONS.map((position) => signedDelta(
    digitAt(previous, position),
    digitAt(latest, position),
  ));

  const matches: Array<{ nextDigit: number; similarity: number }> = [];
  for (let anchor = 1; anchor <= draws.length - 2; anchor += 1) {
    const anchorDraw = draws[anchor];
    const beforeAnchor = draws[anchor - 1];
    let stateDistance = 0;
    let movementDistance = 0;

    for (let positionIndex = 0; positionIndex < POSITIONS.length; positionIndex += 1) {
      const position = POSITIONS[positionIndex];
      stateDistance += circularDistance(digitAt(anchorDraw, position), liveDigits[positionIndex]) / 5;
      movementDistance += Math.abs(
        signedDelta(digitAt(beforeAnchor, position), digitAt(anchorDraw, position)) - liveDeltas[positionIndex],
      ) / 10;
    }

    const averageDistance = (stateDistance * 0.35 + movementDistance * 0.65) / POSITIONS.length;
    const age = draws.length - 2 - anchor;
    const recency = Math.pow(0.997, age);
    const similarity = Math.exp(-averageDistance * 2.2) * recency;
    matches.push({
      nextDigit: digitAt(draws[anchor + 1], targetPosition),
      similarity,
    });
  }

  for (const match of matches.sort((left, right) => right.similarity - left.similarity).slice(0, 42)) {
    scores[match.nextDigit] += match.similarity;
  }
  return normalizeDistribution(scores);
}

function distributionsForModel(
  draws: Draw[],
  model: MovementModel,
): PositionDistributions {
  const result = {} as PositionDistributions;
  for (const position of POSITIONS) {
    if (model === "transition") result[position] = transitionDistribution(draws, position);
    else if (model === "motif") result[position] = motifDistribution(draws, position);
    else if (model === "cycle") result[position] = cycleDistribution(draws, position);
    else result[position] = crossDistribution(draws, position);
  }
  return result;
}

export function buildComponentDistributions(draws: Draw[]): ComponentDistributions {
  return {
    transition: distributionsForModel(draws, "transition"),
    motif: distributionsForModel(draws, "motif"),
    cycle: distributionsForModel(draws, "cycle"),
    cross: distributionsForModel(draws, "cross"),
  };
}

export function blendDistributions(
  components: ComponentDistributions,
  weights: MovementWeights,
): PositionDistributions {
  const blended = {} as PositionDistributions;
  for (const position of POSITIONS) {
    const values = DIGITS.map((digit) =>
      components.transition[position][digit] * weights.transition +
      components.motif[position][digit] * weights.motif +
      components.cycle[position][digit] * weights.cycle +
      components.cross[position][digit] * weights.cross,
    );
    blended[position] = normalizeDistribution(values);
  }
  return blended;
}
