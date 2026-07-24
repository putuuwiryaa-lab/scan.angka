import type { Draw, Posisi } from "../engine/types";
import {
  DIGITS,
  POSITIONS,
  digitAt,
  normalizeDistribution,
  signedDelta,
} from "./helpers";
import type { DigitDistribution, MovementRegime } from "./types";

type FusionSignal = "frequency" | "delta" | "motif" | "cycle" | "cross" | "transition";

const FUSION_SIGNALS: FusionSignal[] = [
  "frequency",
  "delta",
  "motif",
  "cycle",
  "cross",
  "transition",
];

function blank(smoothing = 0.15): number[] {
  return Array.from({ length: 10 }, () => smoothing);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function wrap(value: number): number {
  return ((value % 10) + 10) % 10;
}

function valuesOf(draws: Draw[], position: Posisi): number[] {
  return draws.map((draw) => digitAt(draw, position));
}

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 10 - distance);
}

function informationWeight(distribution: number[]): number {
  const normalized = normalizeDistribution(distribution);
  const entropy = normalized.reduce((sum, probability) => {
    if (probability <= 0) return sum;
    return sum - probability * Math.log(probability);
  }, 0) / Math.log(10);
  return 0.75 + Math.max(0, 1 - entropy) * 2.25;
}

function blend(entries: Array<{ distribution: number[]; weight: number }>): DigitDistribution {
  const scores = blank(0);
  for (const entry of entries) {
    const distribution = normalizeDistribution(entry.distribution);
    for (const digit of DIGITS) scores[digit] += distribution[digit] * Math.max(0, entry.weight);
  }
  return normalizeDistribution(scores);
}

function frequencySignal(draws: Draw[], position: Posisi): DigitDistribution {
  const values = valuesOf(draws, position);
  const scores = blank(0.18);
  const halfLife = Math.max(3, Math.min(18, values.length / 3));
  values.forEach((value, index) => {
    const age = values.length - 1 - index;
    scores[value] += Math.exp(-age / halfLife);
  });
  return normalizeDistribution(scores);
}

function deltaSignal(draws: Draw[], position: Posisi): DigitDistribution {
  const values = valuesOf(draws, position);
  if (values.length < 3) return frequencySignal(draws, position);
  const scores = blank(0.14);
  const current = values[values.length - 1];
  const liveDelta = signedDelta(values[values.length - 2], current);
  for (let index = 1; index < values.length - 1; index += 1) {
    const historicalDelta = signedDelta(values[index - 1], values[index]);
    const age = values.length - 2 - index;
    const recency = Math.pow(0.996, age);
    let weight = 0.08;
    if (historicalDelta === liveDelta) weight += 1.7;
    if (Math.sign(historicalDelta) === Math.sign(liveDelta)) weight += 0.32;
    if (values[index] === current) weight += 0.8;
    scores[values[index + 1]] += weight * recency;
  }
  scores[wrap(current + liveDelta)] += 0.75;
  return normalizeDistribution(scores);
}

function motifSignal(draws: Draw[], position: Posisi): DigitDistribution {
  const values = valuesOf(draws, position);
  if (values.length < 8) return deltaSignal(draws, position);
  const deltas = values.slice(1).map((value, index) => signedDelta(values[index], value));
  const size = Math.min(4, Math.max(2, Math.floor(deltas.length / 20)));
  const live = deltas.slice(-size);
  const scores = blank(0.12);
  for (let anchor = size; anchor < deltas.length; anchor += 1) {
    const pattern = deltas.slice(anchor - size, anchor);
    let distance = 0;
    let directions = 0;
    for (let index = 0; index < size; index += 1) {
      distance += Math.abs(pattern[index] - live[index]) / 5;
      if (Math.sign(pattern[index]) === Math.sign(live[index])) directions += 1;
    }
    const age = deltas.length - anchor;
    const similarity = Math.exp(-(distance / size) * 1.9) * (0.6 + 0.4 * directions / size) * Math.pow(0.997, age);
    scores[values[anchor + 1]] += similarity;
  }
  return normalizeDistribution(scores);
}

function cycleSignal(draws: Draw[], position: Posisi): DigitDistribution {
  const values = valuesOf(draws, position);
  const scores = blank(0.16);
  const currentIndex = values.length - 1;
  for (const digit of DIGITS) {
    const occurrences = values.flatMap((value, index) => value === digit ? [index] : []);
    if (!occurrences.length) {
      scores[digit] += 0.7;
      continue;
    }
    const gaps = occurrences.slice(1).map((index, gapIndex) => index - occurrences[gapIndex]);
    const recentGaps = gaps.slice(-6);
    const averageGap = recentGaps.length
      ? recentGaps.reduce((sum, gap) => sum + gap, 0) / recentGaps.length
      : values.length / occurrences.length;
    const currentGap = currentIndex - occurrences[occurrences.length - 1];
    const rhythm = 1 / (1 + Math.abs(currentGap - averageGap));
    const pressure = Math.min(1.8, currentGap / Math.max(1, averageGap));
    scores[digit] += rhythm * 1.45 + pressure * 0.55;
  }
  return normalizeDistribution(scores);
}

function crossSignal(draws: Draw[], targetPosition: Posisi): DigitDistribution {
  if (draws.length < 4) return frequencySignal(draws, targetPosition);
  const scores = blank(0.12);
  const latest = draws[draws.length - 1];
  const previous = draws[draws.length - 2];
  const liveDigits = POSITIONS.map((position) => digitAt(latest, position));
  const liveDeltas = POSITIONS.map((position) => signedDelta(
    digitAt(previous, position),
    digitAt(latest, position),
  ));
  for (let anchor = 1; anchor < draws.length - 1; anchor += 1) {
    let distance = 0;
    for (let positionIndex = 0; positionIndex < POSITIONS.length; positionIndex += 1) {
      const position = POSITIONS[positionIndex];
      distance += circularDistance(digitAt(draws[anchor], position), liveDigits[positionIndex]) / 5;
      distance += Math.abs(
        signedDelta(digitAt(draws[anchor - 1], position), digitAt(draws[anchor], position)) - liveDeltas[positionIndex],
      ) / 10;
    }
    const age = draws.length - 2 - anchor;
    scores[digitAt(draws[anchor + 1], targetPosition)] += Math.exp(-(distance / POSITIONS.length) * 2.1) * Math.pow(0.997, age);
  }
  return normalizeDistribution(scores);
}

function transitionSignal(draws: Draw[], position: Posisi): DigitDistribution {
  const values = valuesOf(draws, position);
  if (values.length < 4) return deltaSignal(draws, position);
  const deltas = values.slice(1).map((value, index) => signedDelta(values[index], value));
  const current = values[values.length - 1];
  const liveDelta = deltas[deltas.length - 1];
  const scores = blank(0.12);
  for (let index = 0; index < deltas.length - 1; index += 1) {
    const age = deltas.length - 2 - index;
    const recency = Math.pow(0.995, age);
    const projected = wrap(current + deltas[index + 1]);
    scores[projected] += 0.08 * recency;
    if (deltas[index] === liveDelta) scores[projected] += 2.1 * recency;
    else if (Math.sign(deltas[index]) === Math.sign(liveDelta)) scores[projected] += 0.28 * recency;
  }
  return normalizeDistribution(scores);
}

function signalDistribution(draws: Draw[], position: Posisi, signal: FusionSignal): DigitDistribution {
  if (signal === "frequency") return frequencySignal(draws, position);
  if (signal === "delta") return deltaSignal(draws, position);
  if (signal === "motif") return motifSignal(draws, position);
  if (signal === "cycle") return cycleSignal(draws, position);
  if (signal === "cross") return crossSignal(draws, position);
  return transitionSignal(draws, position);
}

function histogram(values: number[]): number[] {
  const scores = blank(0.25);
  for (const value of values) scores[value] += 1;
  return normalizeDistribution(scores);
}

function totalVariation(left: number[], right: number[]): number {
  const a = normalizeDistribution(left);
  const b = normalizeDistribution(right);
  return clamp(a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / 2, 0, 1);
}

function changePressure(values: number[]): number {
  if (values.length < 10) return 0.5;
  const block = Math.min(7, Math.floor(values.length / 2));
  const recent = values.slice(-block);
  const previous = values.slice(-block * 2, -block);
  const levelShift = totalVariation(histogram(recent), histogram(previous));
  const recentDeltas = recent.slice(1).map((value, index) => signedDelta(recent[index], value));
  const previousDeltas = previous.slice(1).map((value, index) => signedDelta(previous[index], value));
  const recentMean = recentDeltas.reduce((sum, value) => sum + value, 0) / Math.max(1, recentDeltas.length);
  const previousMean = previousDeltas.reduce((sum, value) => sum + value, 0) / Math.max(1, previousDeltas.length);
  return clamp(levelShift * 0.72 + Math.min(1, Math.abs(recentMean - previousMean) / 5) * 0.28, 0, 1);
}

function memoryDistribution(values: number[], runLength: number): DigitDistribution {
  const segment = values.slice(-Math.max(4, runLength));
  const scores = blank(0.12);
  if (segment.length < 3) return normalizeDistribution(scores);
  const current = segment[segment.length - 1];
  const liveDelta = signedDelta(segment[segment.length - 2], current);
  const halfLife = Math.max(2.5, segment.length / 3);
  segment.forEach((value, index) => {
    const age = segment.length - 1 - index;
    scores[value] += 0.38 * Math.exp(-age / halfLife);
  });
  for (let index = 1; index < segment.length - 1; index += 1) {
    const delta = signedDelta(segment[index - 1], segment[index]);
    const age = segment.length - 2 - index;
    let match = 0.08;
    if (segment[index] === current) match += 1.3;
    if (delta === liveDelta) match += 1.5;
    if (Math.sign(delta) === Math.sign(liveDelta)) match += 0.35;
    scores[segment[index + 1]] += match * Math.exp(-age / Math.max(2, halfLife * 0.75));
  }
  scores[wrap(current + liveDelta)] += 0.9;
  return normalizeDistribution(scores);
}

function runLengthEvidence(values: number[], runLength: number): number {
  const validation = Math.min(4, Math.max(1, values.length - 4));
  const firstTarget = Math.max(3, values.length - validation);
  let logLikelihood = 0;
  let seen = 0;
  for (let targetIndex = firstTarget; targetIndex < values.length; targetIndex += 1) {
    const training = values.slice(Math.max(0, targetIndex - runLength), targetIndex);
    if (training.length < 3) continue;
    const distribution = memoryDistribution(training, runLength);
    logLikelihood += Math.log(Math.max(0.025, distribution[values[targetIndex]]));
    seen += 1;
  }
  return seen ? Math.exp(logLikelihood / seen) : 0.1;
}

export function bayesianChangePointDistribution(draws: Draw[], position: Posisi): DigitDistribution {
  const values = valuesOf(draws, position);
  if (values.length < 6) return deltaSignal(draws, position);
  const lengths = [...new Set([7, 14, 28, 56, 112]
    .map((length) => Math.min(length, values.length))
    .filter((length) => length >= 4))]
    .sort((left, right) => left - right);
  const pressure = changePressure(values);
  const minimum = lengths[0];
  const maximum = lengths[lengths.length - 1];
  const range = Math.max(1e-9, Math.log(maximum) - Math.log(minimum));
  const hazard = 1 / 28;
  return blend(lengths.map((runLength) => {
    const distribution = memoryDistribution(values, runLength);
    const evidence = runLengthEvidence(values, runLength);
    const depth = maximum === minimum ? 0.5 : (Math.log(runLength) - Math.log(minimum)) / range;
    const weight = Math.max(0.01,
      Math.pow(evidence, 1.7) *
      Math.pow(Math.pow(1 - hazard, runLength - 1), 0.18) *
      Math.exp(pressure * 2.4 * (1 - depth)) *
      Math.exp((1 - pressure) * 1.6 * depth) *
      Math.pow(informationWeight(distribution), 0.2));
    return { distribution, weight };
  }));
}

function detectRegime(values: number[]): MovementRegime {
  if (values.length < 5) return "CHAOTIC";
  const deltas = values.slice(-11).slice(1).map((value, index, recent) => {
    const source = values.length - recent.length - 1 + index;
    return signedDelta(values[source], value);
  });
  const signs = deltas.map(Math.sign);
  if (signs.filter((sign) => sign === 0).length / Math.max(1, signs.length) >= 0.3) return "STABIL";
  let alternating = 0;
  let comparable = 0;
  for (let index = 1; index < signs.length; index += 1) {
    if (!signs[index] || !signs[index - 1]) continue;
    comparable += 1;
    if (signs[index] !== signs[index - 1]) alternating += 1;
  }
  if (comparable && alternating / comparable >= 0.65) return "ZIGZAG";
  const nonZero = signs.filter(Boolean);
  if (nonZero.length >= 4) {
    const last = nonZero[nonZero.length - 1];
    if (nonZero.slice(-4, -1).every((sign) => sign === -last)) return "REVERSAL";
  }
  const positive = signs.filter((sign) => sign > 0).length / Math.max(1, signs.length);
  const negative = signs.filter((sign) => sign < 0).length / Math.max(1, signs.length);
  return Math.max(positive, negative) >= 0.65 ? "TREND" : "CHAOTIC";
}

function regimePrior(regime: MovementRegime, signal: FusionSignal): number {
  const priors: Record<MovementRegime, Record<FusionSignal, number>> = {
    TREND: { frequency: 0.92, delta: 1.22, motif: 0.82, cycle: 0.72, cross: 0.88, transition: 1.42 },
    ZIGZAG: { frequency: 0.82, delta: 0.92, motif: 1.52, cycle: 0.85, cross: 1.18, transition: 1.32 },
    REVERSAL: { frequency: 0.88, delta: 1.18, motif: 1.28, cycle: 0.82, cross: 1.02, transition: 1.5 },
    STABIL: { frequency: 1.12, delta: 0.9, motif: 1.12, cycle: 1.52, cross: 0.82, transition: 0.88 },
    CHAOTIC: { frequency: 0.96, delta: 0.92, motif: 1.16, cycle: 1.05, cross: 1.35, transition: 1.08 },
  };
  return priors[regime][signal];
}

function lossOf(distribution: number[], actual: number): number {
  const normalized = normalizeDistribution(distribution);
  const brier = normalized.reduce((sum, probability, digit) =>
    sum + Math.pow(probability - (digit === actual ? 1 : 0), 2), 0) / 10;
  const topThree = DIGITS
    .map((digit) => ({ digit, probability: normalized[digit] }))
    .sort((left, right) => right.probability - left.probability || left.digit - right.digit)
    .slice(0, 3)
    .some((item) => item.digit === actual);
  return brier * 0.72 + (topThree ? 0 : 0.28);
}

function cappedWeights(raw: number[], cap = 0.42): number[] {
  const total = raw.reduce((sum, value) => sum + Math.max(0, value), 0);
  let weights = total > 0 ? raw.map((value) => Math.max(0, value) / total) : raw.map(() => 1 / raw.length);
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const excess = weights.reduce((sum, value) => sum + Math.max(0, value - cap), 0);
    if (excess <= 1e-12) break;
    weights = weights.map((value) => Math.min(cap, value));
    const capacity = weights.map((value) => Math.max(0, cap - value));
    const capacityTotal = capacity.reduce((sum, value) => sum + value, 0);
    if (capacityTotal <= 0) break;
    weights = weights.map((value, index) => value + excess * capacity[index] / capacityTotal);
  }
  const normalizedTotal = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / normalizedTotal);
}

export function adaptiveContextualFusionDistribution(draws: Draw[], position: Posisi): DigitDistribution {
  if (draws.length < 8) return deltaSignal(draws, position);
  const regime = detectRegime(valuesOf(draws, position));
  const logWeights = new Map(FUSION_SIGNALS.map((signal) => [signal, Math.log(regimePrior(regime, signal))]));
  const calibration = Math.min(5, Math.max(0, draws.length - 6));
  const firstTarget = Math.max(4, draws.length - calibration);
  for (let targetIndex = firstTarget; targetIndex < draws.length; targetIndex += 1) {
    const training = draws.slice(0, targetIndex);
    const actual = digitAt(draws[targetIndex], position);
    for (const signal of FUSION_SIGNALS) {
      const previous = logWeights.get(signal) ?? 0;
      const loss = lossOf(signalDistribution(training, position, signal), actual);
      logWeights.set(signal, previous * 0.985 - loss * 1.35);
    }
  }
  const distributions = FUSION_SIGNALS.map((signal) => signalDistribution(draws, position, signal));
  const rawWeights = FUSION_SIGNALS.map((signal, index) =>
    0.03 + Math.exp(logWeights.get(signal) ?? 0) * Math.pow(informationWeight(distributions[index]), 0.35));
  const weights = cappedWeights(rawWeights);
  return blend(distributions.map((distribution, index) => ({ distribution, weight: weights[index] })));
}
