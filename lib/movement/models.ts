import type { Draw, Posisi } from "../engine/types";
import {
  DIGITS,
  POSITIONS,
  digitAt,
  modularDelta,
  normalizeDistribution,
  signedDelta,
} from "./helpers";
import {
  adaptiveContextualFusionDistribution,
  bayesianChangePointDistribution,
} from "./fresh-adaptive";
import type {
  BasePositionMovementMethod,
  DigitDistribution,
  MovementRegime,
  PositionDistributions,
} from "./types";

export type JointPairDistribution = number[];

function blankScores(smoothing = 0.35, size = 10): number[] {
  return Array.from({ length: size }, () => smoothing);
}

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 10 - distance);
}

function wrapDigit(value: number): number {
  return ((value % 10) + 10) % 10;
}

function positionValues(draws: Draw[], position: Posisi): number[] {
  return draws.map((draw) => digitAt(draw, position));
}

function blendDistributions(
  entries: Array<{ distribution: number[]; weight: number }>,
): number[] {
  const size = Math.max(1, ...entries.map((entry) => entry.distribution.length));
  const scores = Array.from({ length: size }, () => 0);

  for (const entry of entries) {
    const distribution = normalizeDistribution(entry.distribution);
    const weight = Math.max(0, entry.weight);
    for (let index = 0; index < size; index += 1) {
      scores[index] += (distribution[index] ?? 0) * weight;
    }
  }

  return normalizeDistribution(scores);
}

function informationWeight(distribution: number[]): number {
  const normalized = normalizeDistribution(distribution);
  const entropy = normalized.reduce((sum, probability) => {
    if (probability <= 0) return sum;
    return sum - probability * Math.log(probability);
  }, 0) / Math.log(Math.max(2, normalized.length));
  return 0.65 + Math.max(0, 1 - entropy) * 2.8;
}

function deltaDistribution(draws: Draw[], position: Posisi): DigitDistribution {
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
  if (values.length < 8) return deltaDistribution(draws, position);

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
  const recent = values.slice(-Math.min(40, values.length));

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
  if (draws.length < 4) return deltaDistribution(draws, targetPosition);

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
    matches.push({ nextDigit: digitAt(draws[anchor + 1], targetPosition), similarity });
  }

  for (const match of matches.sort((left, right) => right.similarity - left.similarity).slice(0, 42)) {
    scores[match.nextDigit] += match.similarity;
  }
  return normalizeDistribution(scores);
}

function momentumDecayDistribution(draws: Draw[], position: Posisi): DigitDistribution {
  const values = positionValues(draws, position);
  if (values.length < 3) return deltaDistribution(draws, position);

  const scores = blankScores(0.18);
  const lastIndex = values.length - 1;
  const liveCurrent = values[lastIndex];
  const liveDelta = signedDelta(values[lastIndex - 1], liveCurrent);
  const halfLife = Math.max(4, Math.min(18, values.length / 4));

  for (let index = 0; index < values.length; index += 1) {
    const age = lastIndex - index;
    scores[values[index]] += 0.28 * Math.exp(-age / halfLife);
  }

  for (let index = 1; index < values.length - 1; index += 1) {
    const current = values[index];
    const previous = values[index - 1];
    const next = values[index + 1];
    const delta = signedDelta(previous, current);
    const age = values.length - 2 - index;
    const recency = Math.exp(-age / Math.max(3, halfLife * 0.7));

    let similarity = 0.1;
    if (current === liveCurrent) similarity += 0.85;
    if (delta === liveDelta) similarity += 1.1;
    if (Math.sign(delta) === Math.sign(liveDelta)) similarity += 0.34;
    scores[next] += similarity * recency;
  }

  const recentDeltas = values.slice(-5).slice(1).map((value, index, recent) => {
    const source = values.length - recent.length - 1 + index;
    return signedDelta(values[source], value);
  });
  const weightedDelta = recentDeltas.length
    ? recentDeltas.reduce((sum, delta, index) => sum + delta * (index + 1), 0) /
      recentDeltas.reduce((sum, _delta, index) => sum + index + 1, 0)
    : liveDelta;
  scores[wrapDigit(liveCurrent + Math.round(weightedDelta))] += 1.65;
  scores[wrapDigit(liveCurrent + liveDelta)] += 0.9;

  return normalizeDistribution(scores);
}

function transitionMatrixDistribution(draws: Draw[], position: Posisi): DigitDistribution {
  const values = positionValues(draws, position);
  if (values.length < 4) return deltaDistribution(draws, position);

  const deltas = values.slice(1).map((value, index) => signedDelta(values[index], value));
  const liveDelta = deltas[deltas.length - 1];
  const liveCurrent = values[values.length - 1];
  const scores = blankScores(0.16);
  let exactTransitions = 0;

  for (let index = 0; index < deltas.length - 1; index += 1) {
    const fromDelta = deltas[index];
    const toDelta = deltas[index + 1];
    const age = deltas.length - 2 - index;
    const recency = Math.pow(0.995, age);
    const projectedDigit = wrapDigit(liveCurrent + toDelta);

    scores[projectedDigit] += 0.06 * recency;
    if (fromDelta === liveDelta) {
      scores[projectedDigit] += 2.25 * recency;
      exactTransitions += 1;
    } else if (Math.sign(fromDelta) === Math.sign(liveDelta)) {
      scores[projectedDigit] += 0.3 * recency;
    }
  }

  if (!exactTransitions) {
    for (const delta of deltas.slice(-8)) {
      scores[wrapDigit(liveCurrent + delta)] += 0.24;
    }
  }

  return normalizeDistribution(scores);
}

function detectPositionRegime(values: number[]): MovementRegime {
  if (values.length < 5) return "CHAOTIC";
  const deltas = values.slice(-11).slice(1).map((value, index, recent) => {
    const source = values.length - recent.length - 1 + index;
    return signedDelta(values[source], value);
  });
  const signs = deltas.map((delta) => Math.sign(delta));
  const stableShare = signs.filter((sign) => sign === 0).length / Math.max(1, signs.length);
  if (stableShare >= 0.3) return "STABIL";

  let alternating = 0;
  let comparable = 0;
  for (let index = 1; index < signs.length; index += 1) {
    if (!signs[index] || !signs[index - 1]) continue;
    comparable += 1;
    if (signs[index] !== signs[index - 1]) alternating += 1;
  }
  if (comparable && alternating / comparable >= 0.65) return "ZIGZAG";

  const nonZero = signs.filter((sign) => sign !== 0);
  if (nonZero.length >= 4) {
    const last = nonZero[nonZero.length - 1];
    if (nonZero.slice(-4, -1).every((sign) => sign === -last)) return "REVERSAL";
  }

  const positiveShare = signs.filter((sign) => sign > 0).length / Math.max(1, signs.length);
  const negativeShare = signs.filter((sign) => sign < 0).length / Math.max(1, signs.length);
  if (Math.max(positiveShare, negativeShare) >= 0.65) return "TREND";
  return "CHAOTIC";
}

function regimeAdaptiveDistribution(draws: Draw[], position: Posisi): DigitDistribution {
  const regime = detectPositionRegime(positionValues(draws, position));

  if (regime === "TREND") {
    return blendDistributions([
      { distribution: momentumDecayDistribution(draws, position), weight: 0.46 },
      { distribution: deltaDistribution(draws, position), weight: 0.3 },
      { distribution: transitionMatrixDistribution(draws, position), weight: 0.24 },
    ]);
  }
  if (regime === "ZIGZAG") {
    return blendDistributions([
      { distribution: motifDistribution(draws, position), weight: 0.42 },
      { distribution: transitionMatrixDistribution(draws, position), weight: 0.34 },
      { distribution: crossDistribution(draws, position), weight: 0.24 },
    ]);
  }
  if (regime === "REVERSAL") {
    return blendDistributions([
      { distribution: transitionMatrixDistribution(draws, position), weight: 0.4 },
      { distribution: motifDistribution(draws, position), weight: 0.34 },
      { distribution: deltaDistribution(draws, position), weight: 0.26 },
    ]);
  }
  if (regime === "STABIL") {
    return blendDistributions([
      { distribution: cycleDistribution(draws, position), weight: 0.45 },
      { distribution: momentumDecayDistribution(draws, position), weight: 0.3 },
      { distribution: motifDistribution(draws, position), weight: 0.25 },
    ]);
  }

  return blendDistributions([
    { distribution: crossDistribution(draws, position), weight: 0.3 },
    { distribution: cycleDistribution(draws, position), weight: 0.25 },
    { distribution: motifDistribution(draws, position), weight: 0.25 },
    { distribution: deltaDistribution(draws, position), weight: 0.2 },
  ]);
}

function consensusDistribution(draws: Draw[], position: Posisi): DigitDistribution {
  const distributions = [
    deltaDistribution(draws, position),
    motifDistribution(draws, position),
    cycleDistribution(draws, position),
    crossDistribution(draws, position),
    momentumDecayDistribution(draws, position),
    transitionMatrixDistribution(draws, position),
    regimeAdaptiveDistribution(draws, position),
  ];

  return blendDistributions(distributions.map((distribution) => ({
    distribution,
    weight: informationWeight(distribution),
  })));
}

export function buildMethodDistributions(
  draws: Draw[],
  method: BasePositionMovementMethod,
): PositionDistributions {
  const result = {} as PositionDistributions;
  for (const position of POSITIONS) {
    if (method === "delta") result[position] = deltaDistribution(draws, position);
    else if (method === "motif") result[position] = motifDistribution(draws, position);
    else if (method === "cycle") result[position] = cycleDistribution(draws, position);
    else if (method === "cross") result[position] = crossDistribution(draws, position);
    else if (method === "momentum_decay") result[position] = momentumDecayDistribution(draws, position);
    else if (method === "transition_matrix") result[position] = transitionMatrixDistribution(draws, position);
    else if (method === "bayesian_change_point") result[position] = bayesianChangePointDistribution(draws, position);
    else if (method === "adaptive_contextual_fusion") result[position] = adaptiveContextualFusionDistribution(draws, position);
    else if (method === "regime_adaptive") result[position] = regimeAdaptiveDistribution(draws, position);
    else result[position] = consensusDistribution(draws, position);
  }
  return result;
}

function pairIndex(first: number, second: number): number {
  return first * 10 + second;
}

export function buildJointPairDistribution(
  draws: Draw[],
  positions: [Posisi, Posisi],
): JointPairDistribution {
  const scores = blankScores(0.04, 100);
  if (draws.length < 4) return normalizeDistribution(scores);

  const latest = draws[draws.length - 1];
  const previous = draws[draws.length - 2];
  const liveFirst = digitAt(latest, positions[0]);
  const liveSecond = digitAt(latest, positions[1]);
  const liveDeltaFirst = signedDelta(digitAt(previous, positions[0]), liveFirst);
  const liveDeltaSecond = signedDelta(digitAt(previous, positions[1]), liveSecond);

  for (let anchor = 1; anchor <= draws.length - 2; anchor += 1) {
    const current = draws[anchor];
    const before = draws[anchor - 1];
    const next = draws[anchor + 1];
    const currentFirst = digitAt(current, positions[0]);
    const currentSecond = digitAt(current, positions[1]);
    const deltaFirst = signedDelta(digitAt(before, positions[0]), currentFirst);
    const deltaSecond = signedDelta(digitAt(before, positions[1]), currentSecond);

    const stateDistance = (
      circularDistance(currentFirst, liveFirst) +
      circularDistance(currentSecond, liveSecond)
    ) / 10;
    const movementDistance = (
      Math.abs(deltaFirst - liveDeltaFirst) +
      Math.abs(deltaSecond - liveDeltaSecond)
    ) / 20;
    const age = draws.length - 2 - anchor;
    const recency = Math.pow(0.996, age);
    const similarity = Math.exp(-(stateDistance * 0.35 + movementDistance * 0.65) * 2.4) * recency;
    const nextFirst = digitAt(next, positions[0]);
    const nextSecond = digitAt(next, positions[1]);
    scores[pairIndex(nextFirst, nextSecond)] += 0.15 + similarity * 1.8;
  }

  return normalizeDistribution(scores);
}
