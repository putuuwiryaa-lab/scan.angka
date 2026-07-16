import type { Draw, Posisi } from "../engine/types";
import {
  TRAINING_WINDOW_STEP,
  WALK_FORWARD_SIZE,
  evaluateMovementTournament,
} from "./evaluator";
import {
  DIGITS,
  clamp,
  digitAt,
  normalizeDigitCount,
  objectiveLabel,
  signedDelta,
  targetPositionsFor,
} from "./helpers";
import {
  MOVEMENT_METHODS,
  MOVEMENT_METHOD_LABELS,
  type MovementConfig,
  type MovementRegime,
  type MovementResult,
  type MovementStrength,
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

function strengthOf(released: boolean, hit: number, minimumHits: number): MovementStrength {
  if (!released) return "TIDAK_LAYAK";
  if (hit >= minimumHits + 2 || hit >= 13) return "KUAT";
  if (hit >= minimumHits + 1) return "CUKUP";
  return "PANTAU";
}

function confidenceOf(
  released: boolean,
  l14Hit: number,
  l7Hit: number,
  l3Hit: number,
  minimumHits: number,
  lift: number,
  missStreak: number,
): number {
  if (!released) {
    return Math.round(clamp(28 + l14Hit * 2 - missStreak * 2, 20, 49));
  }
  const excessHits = l14Hit - minimumHits;
  return Math.round(clamp(
    58 + excessHits * 6 + l7Hit * 1.3 + l3Hit * 1.5 + lift * 0.18 - missStreak * 2,
    35,
    94,
  ));
}

export function runMovementEngine(draws: Draw[], input: MovementConfig): MovementResult {
  const targetPositions = targetPositionsFor(input.outputType, input.target);
  const digitCount = normalizeDigitCount(input);
  const config: MovementConfig = { ...input, digitCount };
  const tournament = evaluateMovementTournament(
    draws,
    targetPositions,
    config.outputType,
    digitCount,
  );
  const released = true;
  const strength = strengthOf(
    released,
    tournament.evaluation.l14.hit,
    tournament.minimumReleaseHits,
  );
  const confidence = confidenceOf(
    released,
    tournament.evaluation.l14.hit,
    tournament.evaluation.l7.hit,
    tournament.evaluation.l3.hit,
    tournament.minimumReleaseHits,
    tournament.evaluation.l14.lift,
    tournament.evaluation.l14.longestMissStreak,
  );
  const liveDigits = [...tournament.liveSelection.digits].sort((left, right) => left - right);
  const selected = new Set(liveDigits);

  let tieBreakText = "";
  if (tournament.tieBreakStatus === "resolved") {
    tieBreakText = ` Seri L14 membuat seluruh ${tournament.candidateCount} konfigurasi diuji ulang sampai L${tournament.selectionValidation.total}.`;
  } else if (tournament.tieBreakStatus === "history_limit") {
    const reached = tournament.selectionValidation.total;
    tieBreakText = reached > WALK_FORWARD_SIZE
      ? ` Seluruh ${tournament.candidateCount} konfigurasi telah diuji ulang sampai L${reached}; seri masih bertahan dan riwayat tidak cukup untuk naik ke L${reached + 7}, sehingga ranking sekunder digunakan.`
      : " Seri L14 belum dapat diuji ulang karena riwayat training belum cukup; ranking sekunder digunakan.";
  }

  const decidingTotal = tournament.selectionValidation.total;
  const decidingScore = `${tournament.selectionValidation.hit}/${decidingTotal}`;

  return {
    config: {
      ...config,
      targetPositions,
      sourceDataSize: draws.length,
      walkForwardSize: WALK_FORWARD_SIZE,
      windows: tournament.windows,
      candidateCount: tournament.candidateCount,
    },
    latestDraw: draws[draws.length - 1],
    released,
    digits: liveDigits,
    offDigits: DIGITS.filter((digit) => !selected.has(digit)),
    objective: objectiveLabel(config.outputType, targetPositions),
    strength,
    confidence,
    regime: regimeOf(draws, targetPositions),
    selectedMethod: tournament.selectedMethod,
    selectedWindow: tournament.selectedWindow,
    minimumReleaseHits: tournament.minimumReleaseHits,
    probabilities: tournament.liveProbabilities,
    evaluation: tournament.evaluation,
    selectionValidation: tournament.selectionValidation,
    tieBreakStatus: tournament.tieBreakStatus,
    tieBreakInitialCandidateCount: tournament.tieBreakInitialCandidateCount,
    tieBreakRounds: tournament.tieBreakRounds,
    tournament: tournament.tournament,
    rows: tournament.rows,
    message: `${MOVEMENT_METHOD_LABELS[tournament.selectedMethod]} W${tournament.selectedWindow} unggul pada L${decidingTotal} dengan hasil ${decidingScore}.${tieBreakText}`,
  };
}

export const MOVEMENT_INTERNAL_CONFIG = {
  minimumTotalData: 28,
  walkForwardSize: WALK_FORWARD_SIZE,
  trainingWindowStep: TRAINING_WINDOW_STEP,
  methods: MOVEMENT_METHODS,
  aiRequiresMinimumOneTarget: true,
  bbfsRequiresAllTargets: true,
  releaseRequiresBaselineOutperformance: false,
};
