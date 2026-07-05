import { COMBO_PAIRS, COMBO_TRIPLES, CROSS_N_LIST, EXTENDED_OFFSET_LIST, MIRROR_MAP, OFFSET_LIST, POSISI, TESSON_MAP, TREK_PAIRS } from "./constants";
import { digitOf, jumlah2dDigit, mod10, offsetLabel, offsetSuffix } from "./helpers";
import type { Draw, Posisi } from "./types";

export type FormulaType = "base" | "offset" | "tesson" | "tessonOffset" | "mirror" | "mirrorOffset" | "combo" | "comboOffset" | "crossCombo" | "crossDiff" | "tessonCombo" | "mirrorCombo" | "combo3" | "diff" | "absdiff" | "total" | "totalOffset" | "momentum" | "pairMomentum" | "rootPair" | "product" | "mixProduct" | "scaled" | "square" | "cube" | "innerRoot" | "weightedPair" | "weightedPair3" | "indexMultiply" | "mixBalance" | "maxLift" | "sumProduct" | "diffProduct" | "pairExtreme" | "balanceGap" | "rootGabung" | "weightedTriple" | "rootTriple" | "balanceTriple" | "tripleExtreme" | "pairProductTriple" | "spreadTriple" | "weightedQuad" | "alternateQuad" | "rootQuad" | "spreadQuad" | "maxMinQuad" | "quadPairProduct" | "crossWeighted" | "crossIndexMultiply" | "crossMixBalance" | "crossMaxLift" | "crossRootGabung";

export interface FormulaSpec {
  formula: string;
  type: FormulaType;
  typeOrder: number;
  patokanPos: Posisi;
  patokanN: number;
  compute: (draw: Draw) => number;
  computeAt?: (draws: Draw[], targetIndex: number) => number;
}

export function computeFormula(spec: FormulaSpec, draws: Draw[], targetIndex: number): number {
  return spec.computeAt ? spec.computeAt(draws, targetIndex) : spec.compute(draws[targetIndex - spec.patokanN]);
}

const DIRECTED_COMBO_PAIRS: [Posisi, Posisi][] = COMBO_PAIRS.flatMap(([left, right]) => [[left, right], [right, left]] as [Posisi, Posisi][]);
const QUAD_POSITIONS: [Posisi, Posisi, Posisi, Posisi] = ["A", "C", "K", "E"];

function digitalRoot(value: number): number {
  let total = Math.abs(Math.trunc(value));
  while (total >= 10) total = String(total).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return total;
}

function valuesOf(draw: Draw, positions: Posisi[]): number[] {
  return positions.map((pos) => digitOf(draw, pos));
}

function maxOf(values: number[]): number {
  return Math.max(...values);
}

function minOf(values: number[]): number {
  return Math.min(...values);
}

function medianOf(values: number[]): number {
  return [...values].sort((a, b) => a - b)[1];
}

function tripleCode(positions: [Posisi, Posisi, Posisi]): string {
  return positions.join("");
}

function formulaSpecs(): FormulaSpec[] {
  const specs: FormulaSpec[] = [];
  const add = (formula: string, type: FormulaType, typeOrder: number, patokanPos: Posisi, patokanN: number, compute: (draw: Draw) => number, computeAt?: (draws: Draw[], targetIndex: number) => number) => {
    specs.push({ formula, type, typeOrder, patokanPos, patokanN, compute, computeAt });
  };

  for (let N = 1; N <= 9; N += 1) {
    for (const pos of POSISI) {
      for (const offset of OFFSET_LIST) add(offsetLabel(pos, N, offset), offset === 0 ? "base" : "offset", offset === 0 ? 0 : 1, pos, N, (draw) => mod10(digitOf(draw, pos) + offset));
      add(`TS-${pos}${N}`, "tesson", 2, pos, N, (draw) => TESSON_MAP[digitOf(draw, pos)]);
      for (const offset of EXTENDED_OFFSET_LIST) add(`TS-${pos}${N}${offsetSuffix(offset)}`, "tessonOffset", 3, pos, N, (draw) => mod10(TESSON_MAP[digitOf(draw, pos)] + offset));
      add(`M-${pos}${N}`, "mirror", 4, pos, N, (draw) => MIRROR_MAP[digitOf(draw, pos)]);
      for (const offset of EXTENDED_OFFSET_LIST) add(`M-${pos}${N}${offsetSuffix(offset)}`, "mirrorOffset", 5, pos, N, (draw) => mod10(MIRROR_MAP[digitOf(draw, pos)] + offset));

      add(`SQ-${pos}${N}`, "square", 31, pos, N, (draw) => mod10(digitOf(draw, pos) ** 2));
      add(`CU-${pos}${N}`, "cube", 32, pos, N, (draw) => mod10(digitOf(draw, pos) ** 3));
      add(`DB-${pos}${N}`, "scaled", 33, pos, N, (draw) => mod10(digitOf(draw, pos) * 2));
      add(`TR-${pos}${N}`, "scaled", 33, pos, N, (draw) => mod10(digitOf(draw, pos) * 3));
      add(`IR-${pos}${N}`, "innerRoot", 34, pos, N, (draw) => digitalRoot(digitOf(draw, pos) ** 2 + digitOf(draw, pos)));
    }

    for (const [left, right] of COMBO_PAIRS) {
      add(`${left}${N}+${right}${N}`, "combo", 6, left, N, (draw) => mod10(digitOf(draw, left) + digitOf(draw, right)));
      for (const offset of EXTENDED_OFFSET_LIST) add(`${left}${N}+${right}${N}${offsetSuffix(offset)}`, "comboOffset", 7, left, N, (draw) => mod10(digitOf(draw, left) + digitOf(draw, right) + offset));
      add(`${left}${N}+TS-${right}${N}`, "tessonCombo", 10, left, N, (draw) => mod10(digitOf(draw, left) + TESSON_MAP[digitOf(draw, right)]));
      add(`${right}${N}+TS-${left}${N}`, "tessonCombo", 10, right, N, (draw) => mod10(digitOf(draw, right) + TESSON_MAP[digitOf(draw, left)]));
      add(`TS-${left}${N}+TS-${right}${N}`, "tessonCombo", 10, left, N, (draw) => mod10(TESSON_MAP[digitOf(draw, left)] + TESSON_MAP[digitOf(draw, right)]));
      add(`${left}${N}+M-${right}${N}`, "mirrorCombo", 11, left, N, (draw) => mod10(digitOf(draw, left) + MIRROR_MAP[digitOf(draw, right)]));
      add(`${right}${N}+M-${left}${N}`, "mirrorCombo", 11, right, N, (draw) => mod10(digitOf(draw, right) + MIRROR_MAP[digitOf(draw, left)]));
      add(`M-${left}${N}+M-${right}${N}`, "mirrorCombo", 11, left, N, (draw) => mod10(MIRROR_MAP[digitOf(draw, left)] + MIRROR_MAP[digitOf(draw, right)]));
      add(`PX-${left}${right}${N}`, "product", 20, left, N, (draw) => mod10(digitOf(draw, left) * digitOf(draw, right)));

      add(`IX-${left}${right}${N}`, "indexMultiply", 24, left, N, (draw) => mod10((digitOf(draw, left) + 1) * (digitOf(draw, right) + 1)));
      add(`MB-${left}${right}${N}`, "mixBalance", 25, left, N, (draw) => mod10(digitOf(draw, left) + digitOf(draw, right) + Math.abs(digitOf(draw, left) - digitOf(draw, right))));
      add(`ML-${left}${right}${N}`, "maxLift", 26, left, N, (draw) => mod10(Math.max(digitOf(draw, left), digitOf(draw, right)) + Math.abs(digitOf(draw, left) - digitOf(draw, right))));
      add(`SP-${left}${right}${N}`, "sumProduct", 27, left, N, (draw) => mod10(digitOf(draw, left) * digitOf(draw, right) + digitOf(draw, left) + digitOf(draw, right)));
      add(`DP-${left}${right}${N}`, "diffProduct", 28, left, N, (draw) => mod10(digitOf(draw, left) * digitOf(draw, right) + Math.abs(digitOf(draw, left) - digitOf(draw, right))));
      add(`MX-${left}${right}${N}`, "pairExtreme", 29, left, N, (draw) => Math.max(digitOf(draw, left), digitOf(draw, right)));
      add(`MI-${left}${right}${N}`, "pairExtreme", 29, left, N, (draw) => Math.min(digitOf(draw, left), digitOf(draw, right)));
      add(`BG-${left}${right}${N}`, "balanceGap", 30, left, N, (draw) => mod10(digitOf(draw, left) + digitOf(draw, right) + 2 * Math.abs(digitOf(draw, left) - digitOf(draw, right))));
      add(`RG-${left}${right}${N}`, "rootGabung", 30, left, N, (draw) => digitalRoot(digitOf(draw, left) + digitOf(draw, right)));
    }

    for (const [left, right] of DIRECTED_COMBO_PAIRS) {
      add(`WD-${left}${right}${N}`, "weightedPair", 22, left, N, (draw) => mod10(digitOf(draw, left) * 2 + digitOf(draw, right)));
      add(`W3-${left}${right}${N}`, "weightedPair3", 23, left, N, (draw) => mod10(digitOf(draw, left) * 3 + digitOf(draw, right)));
    }

    for (const triple of COMBO_TRIPLES) {
      const [left, middle, right] = triple;
      const code = tripleCode(triple);
      const tripleValues = (draw: Draw) => valuesOf(draw, triple);
      const tripleSum = (draw: Draw) => tripleValues(draw).reduce((sum, value) => sum + value, 0);

      add(`${left}${N}+${middle}${N}+${right}${N}`, "combo3", 12, left, N, (draw) => mod10(digitOf(draw, left) + digitOf(draw, middle) + digitOf(draw, right)));
      add(`WT3${left}-${code}${N}`, "weightedTriple", 35, left, N, (draw) => mod10(digitOf(draw, left) * 2 + digitOf(draw, middle) + digitOf(draw, right)));
      add(`WT3${middle}-${code}${N}`, "weightedTriple", 35, middle, N, (draw) => mod10(digitOf(draw, left) + digitOf(draw, middle) * 2 + digitOf(draw, right)));
      add(`WT3${right}-${code}${N}`, "weightedTriple", 35, right, N, (draw) => mod10(digitOf(draw, left) + digitOf(draw, middle) + digitOf(draw, right) * 2));
      add(`DR3-${code}${N}`, "rootTriple", 36, left, N, (draw) => digitalRoot(tripleSum(draw)));
      add(`BT3-${code}${N}`, "balanceTriple", 37, left, N, (draw) => mod10(tripleSum(draw) + maxOf(tripleValues(draw)) - minOf(tripleValues(draw))));
      add(`MX3-${code}${N}`, "tripleExtreme", 38, left, N, (draw) => maxOf(tripleValues(draw)));
      add(`MI3-${code}${N}`, "tripleExtreme", 38, left, N, (draw) => minOf(tripleValues(draw)));
      add(`MD3-${code}${N}`, "tripleExtreme", 38, left, N, (draw) => medianOf(tripleValues(draw)));
      add(`PP3-${code}${N}`, "pairProductTriple", 39, left, N, (draw) => mod10(digitOf(draw, left) * digitOf(draw, middle) + digitOf(draw, left) * digitOf(draw, right) + digitOf(draw, middle) * digitOf(draw, right)));
      add(`SG3-${code}${N}`, "spreadTriple", 40, left, N, (draw) => maxOf(tripleValues(draw)) - minOf(tripleValues(draw)));
    }

    for (const left of POSISI) for (const right of POSISI) if (left !== right) add(`${left}${N}-${right}${N}`, "diff", 13, left, N, (draw) => mod10(digitOf(draw, left) - digitOf(draw, right)));
    for (const [left, right] of COMBO_PAIRS) add(`D-${left}${right}${N}`, "absdiff", 14, left, N, (draw) => Math.abs(digitOf(draw, left) - digitOf(draw, right)));
    add(`T${N}`, "total", 15, "A", N, (draw) => mod10(POSISI.reduce((sum, pos) => sum + digitOf(draw, pos), 0)));
    for (const offset of EXTENDED_OFFSET_LIST) add(`T${N}${offsetSuffix(offset)}`, "totalOffset", 16, "A", N, (draw) => mod10(POSISI.reduce((sum, pos) => sum + digitOf(draw, pos), 0) + offset));
    for (const [left, right] of TREK_PAIRS) add(`JR-${left}${right}${N}`, "rootPair", 19, left, N, (draw) => jumlah2dDigit(digitOf(draw, left), digitOf(draw, right)));
    add(`MP-ACKE${N}`, "mixProduct", 21, "A", N, (draw) => mod10(digitOf(draw, "A") * digitOf(draw, "C") + digitOf(draw, "K") * digitOf(draw, "E")));
    add(`MP-AKCE${N}`, "mixProduct", 21, "A", N, (draw) => mod10(digitOf(draw, "A") * digitOf(draw, "K") + digitOf(draw, "C") * digitOf(draw, "E")));
    add(`MP-AECK${N}`, "mixProduct", 21, "A", N, (draw) => mod10(digitOf(draw, "A") * digitOf(draw, "E") + digitOf(draw, "C") * digitOf(draw, "K")));

    const quadValues = (draw: Draw) => valuesOf(draw, QUAD_POSITIONS);
    const quadSum = (draw: Draw) => quadValues(draw).reduce((sum, value) => sum + value, 0);
    add(`QW1-${N}`, "weightedQuad", 41, "A", N, (draw) => mod10(digitOf(draw, "A") + digitOf(draw, "C") * 2 + digitOf(draw, "K") * 3 + digitOf(draw, "E") * 4));
    add(`QW2-${N}`, "weightedQuad", 41, "A", N, (draw) => mod10(digitOf(draw, "A") * 4 + digitOf(draw, "C") * 3 + digitOf(draw, "K") * 2 + digitOf(draw, "E")));
    add(`QW3-${N}`, "weightedQuad", 41, "A", N, (draw) => mod10(digitOf(draw, "A") + digitOf(draw, "C") * 3 + digitOf(draw, "K") + digitOf(draw, "E") * 3));
    add(`QW4-${N}`, "weightedQuad", 41, "A", N, (draw) => mod10(digitOf(draw, "A") * 2 + digitOf(draw, "C") + digitOf(draw, "K") * 2 + digitOf(draw, "E")));
    add(`ALT1-${N}`, "alternateQuad", 42, "A", N, (draw) => mod10(digitOf(draw, "A") - digitOf(draw, "C") + digitOf(draw, "K") - digitOf(draw, "E")));
    add(`ALT2-${N}`, "alternateQuad", 42, "A", N, (draw) => mod10(digitOf(draw, "A") + digitOf(draw, "C") - digitOf(draw, "K") - digitOf(draw, "E")));
    add(`ALT3-${N}`, "alternateQuad", 42, "A", N, (draw) => mod10(digitOf(draw, "A") - digitOf(draw, "C") - digitOf(draw, "K") + digitOf(draw, "E")));
    add(`DR4-${N}`, "rootQuad", 43, "A", N, (draw) => digitalRoot(quadSum(draw)));
    add(`SP4-${N}`, "spreadQuad", 44, "A", N, (draw) => maxOf(quadValues(draw)) - minOf(quadValues(draw)));
    add(`MM4-${N}`, "maxMinQuad", 45, "A", N, (draw) => mod10(maxOf(quadValues(draw)) + minOf(quadValues(draw))));
    add(`QPX-${N}`, "quadPairProduct", 46, "A", N, (draw) => mod10(digitOf(draw, "A") * digitOf(draw, "C") + digitOf(draw, "A") * digitOf(draw, "K") + digitOf(draw, "A") * digitOf(draw, "E") + digitOf(draw, "C") * digitOf(draw, "K") + digitOf(draw, "C") * digitOf(draw, "E") + digitOf(draw, "K") * digitOf(draw, "E")));
  }

  for (let N = 1; N <= 8; N += 1) {
    for (const pos of POSISI) {
      add(`MO-${pos}${N}`, "momentum", 17, pos, N + 1, () => 0, (draws, targetIndex) => {
        const current = digitOf(draws[targetIndex - N], pos);
        const previous = digitOf(draws[targetIndex - N - 1], pos);
        return mod10(current + (current - previous));
      });
    }
    for (const [left, right] of TREK_PAIRS) {
      add(`PM-${left}${right}${N}`, "pairMomentum", 18, left, N + 1, () => 0, (draws, targetIndex) => {
        const current = mod10(digitOf(draws[targetIndex - N], left) + digitOf(draws[targetIndex - N], right));
        const previous = mod10(digitOf(draws[targetIndex - N - 1], left) + digitOf(draws[targetIndex - N - 1], right));
        return mod10(current + (current - previous));
      });
    }
  }

  for (const [left, right] of COMBO_PAIRS) {
    for (const leftN of CROSS_N_LIST) for (const rightN of CROSS_N_LIST) if (leftN !== rightN) {
      add(`${left}${leftN}+${right}${rightN}`, "crossCombo", 8, left, Math.max(leftN, rightN), () => 0, (draws, targetIndex) => mod10(digitOf(draws[targetIndex - leftN], left) + digitOf(draws[targetIndex - rightN], right)));
    }
  }

  for (const left of POSISI) for (const right of POSISI) if (left !== right) {
    for (const leftN of CROSS_N_LIST) for (const rightN of CROSS_N_LIST) if (leftN !== rightN) {
      add(`${left}${leftN}-${right}${rightN}`, "crossDiff", 9, left, Math.max(leftN, rightN), () => 0, (draws, targetIndex) => mod10(digitOf(draws[targetIndex - leftN], left) - digitOf(draws[targetIndex - rightN], right)));
      add(`XWD-${left}${leftN}-${right}${rightN}`, "crossWeighted", 47, left, Math.max(leftN, rightN), () => 0, (draws, targetIndex) => mod10(digitOf(draws[targetIndex - leftN], left) * 2 + digitOf(draws[targetIndex - rightN], right)));
      add(`XIX-${left}${leftN}-${right}${rightN}`, "crossIndexMultiply", 48, left, Math.max(leftN, rightN), () => 0, (draws, targetIndex) => mod10((digitOf(draws[targetIndex - leftN], left) + 1) * (digitOf(draws[targetIndex - rightN], right) + 1)));
      add(`XMB-${left}${leftN}-${right}${rightN}`, "crossMixBalance", 49, left, Math.max(leftN, rightN), () => 0, (draws, targetIndex) => {
        const leftDigit = digitOf(draws[targetIndex - leftN], left);
        const rightDigit = digitOf(draws[targetIndex - rightN], right);
        return mod10(leftDigit + rightDigit + Math.abs(leftDigit - rightDigit));
      });
      add(`XML-${left}${leftN}-${right}${rightN}`, "crossMaxLift", 50, left, Math.max(leftN, rightN), () => 0, (draws, targetIndex) => {
        const leftDigit = digitOf(draws[targetIndex - leftN], left);
        const rightDigit = digitOf(draws[targetIndex - rightN], right);
        return mod10(Math.max(leftDigit, rightDigit) + Math.abs(leftDigit - rightDigit));
      });
      add(`XRG-${left}${leftN}-${right}${rightN}`, "crossRootGabung", 51, left, Math.max(leftN, rightN), () => 0, (draws, targetIndex) => digitalRoot(digitOf(draws[targetIndex - leftN], left) + digitOf(draws[targetIndex - rightN], right)));
    }
  }

  return specs;
}

export const ALL_FORMULA_SPECS = formulaSpecs();