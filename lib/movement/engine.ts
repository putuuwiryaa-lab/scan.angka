import type { Draw, Posisi } from "../engine/types";
import { evaluateMovement } from "./evaluator";
import {
  DIGITS,
  clamp,
  digitAt,
  normalizeDigitCount,
  objectiveLabel,
  signedDelta,
  targetPositionsFor,
} from "./helpers";
import { movementProbabilities } from "./optimizer";
import type {
  MovementConfig,
  MovementRegime,
  MovementResult,
  MovementStrength,
} from "./types";

function movementSigns(draws: Draw[], position: Posisi, size: number): number[] {
  const start = Math.max(1, draws.length - size);
  const signs: number[] = [];
  for (let index = start; index < draws.length; index += 1) {
    signs.push(Math.sign(signedDelta(
      digitAt(draws[index - 1], position),
      digitAt(draws[index], position),
    )));
  }
  return signs;
}

function regimeOf(draws: Draw[], positions: Posisi[]): MovementRegime {
  const sequences = positions.map((position) => movementSigns(draws, position, 10));
  const all = sequences.flat();
  if (!all.length) return "CHAOTIC";

  const stableShare = all.filter((sign) => sign === 0).length / all.length;
  if (stableShare >= 0.35) return "STABIL";

  let alternating = 0;
  let comparable = 0;
  for (const sequence of sequences) {
    for (let index = 1; index < sequence.length; index += 1) {
      if (!sequence[index] || !sequence[index - 1]) continue;
      comparable += 1;
      if (sequence[index] !== sequence[index - 1]) alternating += 1;
    }
  }
  if (comparable > 0 && alternating / comparable >= 0.67) return "ZIGZAG";

  const reversal = sequences.some((sequence) => {
    const nonZero = sequence.filter((sign) => sign !== 0);
    if (nonZero.length < 4) return false;
    const last = nonZero[nonZero.length - 1];
    return nonZero.slice(-4, -1).every((sign) => sign === -last);
  });
  if (reversal) return "REVERSAL";

  const positiveShare = all.filter((sign) => sign > 0).length / all.length;
  const negativeShare = all.filter((sign) => sign < 0).length / all.length;
  if (Math.max(positiveShare, negativeShare) >= 0.68) return "TREND";
  return "CHAOTIC";
}

function strengthOf(
  validationLift: number,
  holdoutLift: number,
  l30Lift: number,
  holdoutMissStreak: number,
): MovementStrength {
  if (
    validationLift >= 5 &&
    holdoutLift >= 3 &&
    l30Lift >= 3 &&
    holdoutMissStreak <= 2
  ) return "KUAT";

  const combinedLift = validationLift * 0.45 + holdoutLift * 0.55;
  if (combinedLift > 0 && holdoutLift >= -3 && holdoutMissStreak <= 3) return "CUKUP";
  return "PANTAU";
}

function confidenceOf(
  validationLift: number,
  holdoutLift: number,
  l30Lift: number,
  margin: number,
  missStreak: number,
): number {
  const combinedLift = validationLift * 0.35 + holdoutLift * 0.45 + l30Lift * 0.2;
  const instability = Math.abs(validationLift - holdoutLift);
  const marginBonus = Math.min(8, margin * 900);
  return Math.round(clamp(
    52 + combinedLift * 0.75 - instability * 0.18 + marginBonus - missStreak * 2.5,
    20,
    92,
  ));
}

export function runMovementEngine(draws: Draw[], input: MovementConfig): MovementResult {
  const targetPositions = targetPositionsFor(input.outputType, input.target);
  const digitCount = normalizeDigitCount(input);
  const config: MovementConfig = { ...input, digitCount };
  const evaluation = evaluateMovement(draws, targetPositions, config.outputType, digitCount);
  const digits = [...evaluation.liveSelection.digits].sort((left, right) => left - right);
  const selected = new Set(digits);
  const offDigits = DIGITS.filter((digit) => !selected.has(digit));
  const strength = strengthOf(
    evaluation.validation.lift,
    evaluation.holdout.lift,
    evaluation.l30.lift,
    evaluation.holdout.longestMissStreak,
  );
  const confidence = confidenceOf(
    evaluation.validation.lift,
    evaluation.holdout.lift,
    evaluation.l30.lift,
    evaluation.liveSelection.margin,
    evaluation.holdout.longestMissStreak,
  );

  return {
    config: {
      ...config,
      targetPositions,
      sourceDataSize: draws.length,
      validationSize: evaluation.plan.validationSize,
      holdoutSize: evaluation.plan.holdoutSize,
    },
    latestDraw: draws[draws.length - 1],
    digits,
    offDigits,
    objective: objectiveLabel(config.outputType, targetPositions),
    strength,
    confidence,
    regime: regimeOf(draws, targetPositions),
    selectedProfile: evaluation.profileName,
    weights: evaluation.weights,
    probabilities: movementProbabilities(
      evaluation.liveDistributions,
      targetPositions,
      config.outputType,
    ),
    evaluation: {
      validation: evaluation.validation,
      holdout: evaluation.holdout,
      l15: evaluation.l15,
      l30: evaluation.l30,
      l60: evaluation.l60,
    },
    rows: evaluation.rows,
    message: strength === "PANTAU"
      ? "Output tetap ditampilkan, tetapi performa terbaru belum memberi keunggulan yang stabil terhadap baseline."
      : `Profil ${evaluation.profileName} memberi hasil ${strength.toLowerCase()} pada walk-forward dan holdout terbaru.`,
  };
}

export const MOVEMENT_INTERNAL_CONFIG = {
  minimumTotalData: 80,
  models: ["transition", "motif", "cycle", "cross"],
  outputAlwaysReturned: true,
  aiRequiresMinimumOneTarget: true,
  bbfsRequiresAllTargets: true,
  holdoutUsedForProfileSelection: false,
};
