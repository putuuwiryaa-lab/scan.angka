import { isOffMode, isShioMode, uniqueDigits } from "../engine/helpers";
import type { Kolom, ScanMode } from "../engine/types";
import {
  echoColumnsForMode,
  evaluateFrozenRows,
  fitEchoColumns,
  type EchoColumnFit,
  type EchoPhaseAudit,
  type EchoRowSplit,
} from "./audit";
import type { EchoEvaluationPlan, EchoWindowSpec } from "./config";
import type { EchoPrediction } from "./pattern";
import { familyGroupOf, type EchoSelectableCandidate } from "./selection";
import type {
  EchoBacktestRow,
  EchoFamilyContribution,
  EchoNeighbor,
  EchoProfile,
  EchoRegime,
  EchoWindowAudit,
} from "./types";

export interface EchoEnsembleCandidate extends EchoSelectableCandidate {
  selectionKind: "ensemble";
  contributors: EchoFamilyContribution[];
  frozenColumns: Kolom[];
  liveDeret: number[];
}

type WeightedMember = {
  candidate: EchoSelectableCandidate;
  weight: number;
};

function normalizedReliability(rate: number, baseline: number): number {
  const lift = rate - baseline;
  if (lift >= 0) return Math.min(1, 0.5 + 0.5 * (lift / Math.max(1, 100 - baseline)));
  return Math.max(0, 0.5 + 0.5 * (lift / Math.max(1, baseline)));
}

function normalizeWithCap(raw: Array<{ candidate: EchoSelectableCandidate; value: number }>): WeightedMember[] {
  if (!raw.length) return [];
  const cap = raw.length >= 4 ? 0.35 : raw.length === 3 ? 0.45 : 0.6;
  const safe = raw.map((entry) => ({ ...entry, value: Math.max(0.0001, entry.value) }));
  let remaining = 1;
  let open = [...safe];
  const assigned = new Map<EchoSelectableCandidate, number>();

  while (open.length > 0) {
    const total = open.reduce((sum, entry) => sum + entry.value, 0);
    let cappedAny = false;
    const next: typeof open = [];

    for (const entry of open) {
      const share = total > 0 ? (entry.value / total) * remaining : remaining / open.length;
      if (share > cap && open.length > 1) {
        assigned.set(entry.candidate, cap);
        remaining -= cap;
        cappedAny = true;
      } else {
        next.push(entry);
      }
    }

    if (!cappedAny) {
      const nextTotal = next.reduce((sum, entry) => sum + entry.value, 0);
      for (const entry of next) {
        const share = nextTotal > 0 ? (entry.value / nextTotal) * remaining : remaining / next.length;
        assigned.set(entry.candidate, share);
      }
      break;
    }

    open = next;
    if (remaining <= 0.0001) break;
  }

  const result = safe.map(({ candidate }) => ({
    candidate,
    weight: assigned.get(candidate) ?? 0,
  }));
  const total = result.reduce((sum, entry) => sum + entry.weight, 0);
  return result.map((entry) => ({
    ...entry,
    weight: total > 0 ? entry.weight / total : 1 / result.length,
  }));
}

function discoveryWeights(candidates: EchoSelectableCandidate[]): WeightedMember[] {
  return normalizeWithCap(candidates.map((candidate) => {
    const reliability = normalizedReliability(
      candidate.discoveryFit.weightedAccuracy,
      candidate.discoveryFit.baselineRate,
    );
    const stability = candidate.discoveryFit.windowStability / 100;
    const efficiency = Math.min(1, candidate.discoveryFit.efficiency);
    return {
      candidate,
      value: 0.58 * reliability + 0.27 * stability + 0.15 * efficiency,
    };
  }));
}

function holdoutWeights(candidates: EchoSelectableCandidate[]): WeightedMember[] {
  return normalizeWithCap(candidates.map((candidate) => {
    const discovery = normalizedReliability(
      candidate.discoveryFit.weightedAccuracy,
      candidate.discoveryFit.baselineRate,
    );
    const validation = normalizedReliability(
      candidate.validation.rate,
      candidate.validation.baselineRate,
    );
    const stability = candidate.discoveryFit.windowStability / 100;
    return {
      candidate,
      value: 0.3 * discovery + 0.52 * validation + 0.18 * stability,
    };
  }));
}

function selectedDigits(row: EchoBacktestRow, columns: Kolom[], scanMode: ScanMode): number[] {
  const sourceColumns = echoColumnsForMode(scanMode);
  return columns
    .map((column) => row.deret[sourceColumns.indexOf(column)])
    .filter((digit): digit is number => Number.isFinite(digit));
}

function rankedDigits(
  entries: Array<{ row: EchoBacktestRow; columns: Kolom[]; weight: number }>,
  scanMode: ScanMode,
): number[] {
  const modulus = isShioMode(scanMode) ? 12 : 10;
  const scores = Array.from({ length: modulus }, () => 0);
  const rankPenalty = 0.08;

  for (const entry of entries) {
    const digits = selectedDigits(entry.row, entry.columns, scanMode);
    digits.forEach((digit, index) => {
      const rankWeight = Math.max(0.68, 1 - rankPenalty * index);
      scores[digit] += entry.weight * rankWeight;
    });
    scores[entry.row.patokan] += entry.weight * 0.04;
  }

  return scores
    .map((score, digit) => ({ digit, score }))
    .sort((left, right) => right.score - left.score || left.digit - right.digit)
    .map((entry) => entry.digit);
}

function targetColumnsForRow(deret: number[], targetDigits: number[], scanMode: ScanMode): Kolom[] {
  const columns = echoColumnsForMode(scanMode);
  return uniqueDigits(targetDigits)
    .map((digit) => columns[deret.indexOf(digit)])
    .filter((column): column is Kolom => Boolean(column));
}

function alignedRows(
  members: WeightedMember[],
  phase: keyof EchoRowSplit,
  fits: Map<EchoSelectableCandidate, Kolom[]>,
  scanMode: ScanMode,
): EchoBacktestRow[] {
  const primary = members[0]?.candidate.split[phase] ?? [];
  const memberMaps = new Map(members.map((member) => [
    member.candidate,
    new Map(member.candidate.split[phase].map((row) => [row.targetIndex, row])),
  ]));
  const rows: EchoBacktestRow[] = [];

  for (const base of primary) {
    const entries = members.map((member) => {
      const row = memberMaps.get(member.candidate)?.get(base.targetIndex);
      const columns = fits.get(member.candidate);
      return row && columns ? { row, columns, weight: member.weight } : null;
    }).filter((entry): entry is { row: EchoBacktestRow; columns: Kolom[]; weight: number } => Boolean(entry));
    if (entries.length !== members.length) continue;

    const deret = rankedDigits(entries, scanMode);
    const confidence = entries.reduce((sum, entry) => sum + entry.weight * entry.row.confidence, 0);
    const effectiveNeighbors = entries.reduce((sum, entry) => sum + entry.weight * entry.row.effectiveNeighbors, 0);
    rows.push({
      targetIndex: base.targetIndex,
      displayDraw: base.displayDraw,
      targetDraw: base.targetDraw,
      patokan: deret[0] ?? base.patokan,
      deret,
      targetDigits: [...base.targetDigits],
      targetColumns: targetColumnsForRow(deret, base.targetDigits, scanMode),
      covered: false,
      phase: phase === "discovery" ? "discovery" : phase === "validation" ? "validation" : "holdout",
      confidence: Number(confidence.toFixed(1)),
      effectiveNeighbors: Number(effectiveNeighbors.toFixed(2)),
    });
  }

  return rows;
}

function rate(statuses: boolean[]): number {
  return statuses.length ? Number(((statuses.filter(Boolean).length / statuses.length) * 100).toFixed(1)) : 0;
}

function missStreak(statuses: boolean[]): number {
  let longest = 0;
  let current = 0;
  for (const status of statuses) {
    if (status) current = 0;
    else {
      current += 1;
      longest = Math.max(longest, current);
    }
  }
  return longest;
}

function summarizeDiscovery(
  rows: EchoBacktestRow[],
  columns: Kolom[],
  digitCount: number,
  scanMode: ScanMode,
  specs: EchoWindowSpec[],
): EchoColumnFit {
  const base = evaluateFrozenRows(rows, columns, digitCount, scanMode, "discovery");
  const windows: EchoWindowAudit[] = specs.map(({ size, weight }) => {
    const sample = rows.slice(-Math.min(size, rows.length));
    const audit = evaluateFrozenRows(sample, columns, digitCount, scanMode, "discovery");
    return {
      window: size,
      weight,
      hit: audit.hit,
      total: audit.total,
      rate: audit.rate,
      longestMissStreak: audit.longestMissStreak,
    };
  }).filter((window) => window.total > 0);
  const weightTotal = windows.reduce((sum, window) => sum + window.weight, 0);
  const weightedAccuracy = weightTotal
    ? windows.reduce((sum, window) => sum + window.rate * window.weight, 0) / weightTotal
    : 0;
  const weightedBaseline = weightTotal
    ? specs.reduce((sum, spec) => {
      const sample = rows.slice(-Math.min(spec.size, rows.length));
      const audit = evaluateFrozenRows(sample, columns, digitCount, scanMode, "discovery");
      return sum + audit.baselineRate * spec.weight;
    }, 0) / weightTotal
    : base.baselineRate;
  const rates = windows.map((window) => window.rate);
  const strongest = [...windows].sort((left, right) => right.rate - left.rate || left.window - right.window)[0];
  const weakest = [...windows].sort((left, right) => left.rate - right.rate || right.window - left.window)[0];
  const selected = new Set(columns);
  const usage = rows.reduce(
    (sum, row) => sum + row.targetColumns.filter((column) => selected.has(column)).length,
    0,
  );
  const efficiency = isOffMode(scanMode)
    ? 1 - usage / Math.max(1, rows.length * columns.length)
    : usage / Math.max(1, rows.length * columns.length);

  return {
    columns: [...columns],
    statuses: base.statuses,
    rows: base.rows,
    hit: base.hit,
    total: base.total,
    rate: base.rate,
    weightedAccuracy: Number(weightedAccuracy.toFixed(1)),
    baselineRate: Number(weightedBaseline.toFixed(1)),
    lift: Number((weightedAccuracy - weightedBaseline).toFixed(1)),
    windowStability: rates.length ? Number(Math.max(0, 100 - (Math.max(...rates) - Math.min(...rates))).toFixed(1)) : 0,
    strongestWindow: strongest?.window ?? 0,
    weakestWindow: weakest?.window ?? 0,
    windows,
    longestMissStreak: missStreak(base.statuses),
    efficiency,
  };
}

function modeRegime(members: WeightedMember[]): EchoRegime {
  const totals = new Map<EchoRegime, number>();
  for (const member of members) {
    const regime = member.candidate.live.quality.regime;
    totals.set(regime, (totals.get(regime) ?? 0) + member.weight);
  }
  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "MIXED";
}

function buildLivePrediction(
  members: WeightedMember[],
  scanMode: ScanMode,
  digitCount: number,
): { prediction: EchoPrediction; deret: number[]; digits: number[] } {
  const entries = members.map((member) => ({
    row: {
      targetIndex: -1,
      displayDraw: member.candidate.live.neighbors[0]?.anchorDraw ?? "0000",
      targetDraw: member.candidate.live.neighbors[0]?.nextDraw ?? "0000",
      patokan: member.candidate.live.patokan,
      deret: member.candidate.liveDigits.length
        ? [
          ...member.candidate.liveDigits,
          ...Array.from({ length: isShioMode(scanMode) ? 12 : 10 }, (_, digit) => digit)
            .filter((digit) => !member.candidate.liveDigits.includes(digit)),
        ]
        : Array.from({ length: isShioMode(scanMode) ? 12 : 10 }, (_, digit) => digit),
      targetDigits: [],
      targetColumns: [],
      covered: false,
      phase: "holdout" as const,
      confidence: member.candidate.live.confidence,
      effectiveNeighbors: member.candidate.live.quality.effectiveNeighbors,
    },
    columns: echoColumnsForMode(scanMode).slice(0, member.candidate.liveDigits.length) as Kolom[],
    weight: member.weight,
  }));
  const deret = rankedDigits(entries, scanMode);
  const digits = deret.slice(0, digitCount);
  const confidenceAverage = members.reduce(
    (sum, member) => sum + member.weight * member.candidate.live.confidence,
    0,
  );
  const support = members.reduce((sum, member) => {
    const overlap = digits.filter((digit) => member.candidate.liveDigits.includes(digit)).length /
      Math.max(1, Math.min(digits.length, member.candidate.liveDigits.length));
    return sum + member.weight * overlap;
  }, 0);
  const effectiveNeighbors = members.reduce(
    (sum, member) => sum + member.weight * member.candidate.live.quality.effectiveNeighbors,
    0,
  );
  const meanDistance = members.reduce(
    (sum, member) => sum + member.weight * member.candidate.live.quality.meanDistance,
    0,
  );
  const stability = members.reduce(
    (sum, member) => sum + member.weight * member.candidate.live.quality.ensembleStability,
    0,
  );
  const confidence = Math.round(Math.min(100, confidenceAverage * 0.72 + support * 28));
  const neighbors: EchoNeighbor[] = members
    .flatMap((member) => member.candidate.live.neighbors.map((neighbor) => ({
      ...neighbor,
      weight: neighbor.weight * member.weight,
    })))
    .sort((left, right) => right.weight - left.weight || left.distance - right.distance)
    .slice(0, 14);

  return {
    deret,
    digits,
    prediction: {
      patokan: deret[0] ?? 0,
      confidence,
      confidenceLevel: confidence >= 75 ? "HIGH" : confidence >= 55 ? "MEDIUM" : "LOW",
      quality: {
        neighborCount: neighbors.length,
        effectiveNeighbors: Number(effectiveNeighbors.toFixed(2)),
        meanDistance: Number(meanDistance.toFixed(3)),
        dominantShare: Number((support * 100).toFixed(1)),
        stability: Number(stability.toFixed(1)),
        ensembleStability: Number(stability.toFixed(1)),
        regimeAgreement: Number((support * 100).toFixed(1)),
        regime: modeRegime(members),
      },
      neighbors,
    },
  };
}

export function buildEchoEnsembleCandidate(
  representatives: EchoSelectableCandidate[],
  digitCount: number,
  scanMode: ScanMode,
  plan: EchoEvaluationPlan,
): EchoEnsembleCandidate | null {
  const eligible = representatives.filter((candidate) =>
    candidate.discoveryFit.lift >= 0 &&
    candidate.validation.lift >= 0 &&
    candidate.validation.total >= 6 &&
    candidate.live.quality.effectiveNeighbors >= 4.5);
  if (eligible.length < 2) return null;

  const validationMembers = discoveryWeights(eligible);
  const discoveryFits = new Map(validationMembers.map((member) => [
    member.candidate,
    member.candidate.discoveryFit.columns,
  ]));
  const discoveryRows = alignedRows(validationMembers, "discovery", discoveryFits, scanMode);
  const validationRows = alignedRows(validationMembers, "validation", discoveryFits, scanMode);
  if (discoveryRows.length < plan.discoverySize || validationRows.length < plan.validationSize) return null;

  const activeColumns = echoColumnsForMode(scanMode).slice(0, digitCount) as Kolom[];
  const discoveryFit = summarizeDiscovery(
    discoveryRows,
    activeColumns,
    digitCount,
    scanMode,
    plan.discoveryWindows,
  );
  const validation = evaluateFrozenRows(
    validationRows,
    activeColumns,
    digitCount,
    scanMode,
    "validation",
  );

  const holdoutMembers = holdoutWeights(eligible);
  const preHoldoutFits = new Map<EchoSelectableCandidate, Kolom[]>();
  for (const member of holdoutMembers) {
    const fit = fitEchoColumns(
      [...member.candidate.split.discovery, ...member.candidate.split.validation],
      digitCount,
      scanMode,
      plan.discoveryWindows,
    );
    if (!fit) return null;
    preHoldoutFits.set(member.candidate, fit.columns);
  }
  const holdoutRows = alignedRows(holdoutMembers, "holdout", preHoldoutFits, scanMode);
  if (holdoutRows.length < plan.holdoutSize) return null;

  const productionFits = new Map(holdoutMembers.map((member) => [
    member.candidate,
    member.candidate.productionFit.columns,
  ]));
  const productionDiscoveryRows = alignedRows(holdoutMembers, "discovery", productionFits, scanMode);
  const productionValidationRows = alignedRows(holdoutMembers, "validation", productionFits, scanMode);
  const productionHoldoutRows = alignedRows(holdoutMembers, "holdout", productionFits, scanMode);
  const productionRows = [
    ...productionDiscoveryRows,
    ...productionValidationRows,
    ...productionHoldoutRows,
  ];
  const productionFit = summarizeDiscovery(
    productionRows,
    activeColumns,
    digitCount,
    scanMode,
    plan.discoveryWindows,
  );
  const live = buildLivePrediction(holdoutMembers, scanMode, digitCount);
  const profile: EchoProfile = {
    family: "EN",
    variant: "ensemble",
    formula: `EN-${holdoutMembers.map((member) => familyGroupOf(member.candidate.profile.family)[0]).join("")}`,
    anchorPos: null,
    sourceKind: "position",
    areaPositions: [],
  };
  const contributors: EchoFamilyContribution[] = holdoutMembers.map((member) => ({
    group: familyGroupOf(member.candidate.profile.family),
    family: member.candidate.profile.family,
    formula: member.candidate.profile.formula,
    weight: Number((member.weight * 100).toFixed(1)),
    digits: [...member.candidate.liveDigits],
    validationLift: member.candidate.validation.lift,
  }));

  return {
    profile,
    rows: [...discoveryRows, ...validationRows, ...holdoutRows],
    split: {
      discovery: discoveryRows,
      validation: validationRows,
      holdout: holdoutRows,
    },
    discoveryFit,
    validation,
    productionFit,
    live: live.prediction,
    liveDigits: live.digits,
    score: 0,
    selectionKind: "ensemble",
    contributors,
    frozenColumns: activeColumns,
    liveDeret: live.deret,
  };
}
