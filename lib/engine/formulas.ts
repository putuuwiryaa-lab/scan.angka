import { COMBO_PAIRS, COMBO_TRIPLES, CROSS_N_LIST, EXTENDED_OFFSET_LIST, MIRROR_MAP, OFFSET_LIST, POSISI, TESSON_MAP, TREK_PAIRS } from "./constants";
import { digitOf, jumlah2dDigit, mod10, offsetLabel, offsetSuffix } from "./helpers";
import type { Draw, Posisi } from "./types";

export type FormulaType = "base" | "offset" | "tesson" | "tessonOffset" | "mirror" | "mirrorOffset" | "combo" | "comboOffset" | "crossCombo" | "crossDiff" | "tessonCombo" | "mirrorCombo" | "combo3" | "diff" | "absdiff" | "total" | "totalOffset" | "momentum" | "pairMomentum" | "rootPair" | "product" | "mixProduct";

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
    }

    for (const [left, middle, right] of COMBO_TRIPLES) add(`${left}${N}+${middle}${N}+${right}${N}`, "combo3", 12, left, N, (draw) => mod10(digitOf(draw, left) + digitOf(draw, middle) + digitOf(draw, right)));
    for (const left of POSISI) for (const right of POSISI) if (left !== right) add(`${left}${N}-${right}${N}`, "diff", 13, left, N, (draw) => mod10(digitOf(draw, left) - digitOf(draw, right)));
    for (const [left, right] of COMBO_PAIRS) add(`D-${left}${right}${N}`, "absdiff", 14, left, N, (draw) => Math.abs(digitOf(draw, left) - digitOf(draw, right)));
    add(`T${N}`, "total", 15, "A", N, (draw) => mod10(POSISI.reduce((sum, pos) => sum + digitOf(draw, pos), 0)));
    for (const offset of EXTENDED_OFFSET_LIST) add(`T${N}${offsetSuffix(offset)}`, "totalOffset", 16, "A", N, (draw) => mod10(POSISI.reduce((sum, pos) => sum + digitOf(draw, pos), 0) + offset));
    for (const [left, right] of TREK_PAIRS) add(`JR-${left}${right}${N}`, "rootPair", 19, left, N, (draw) => jumlah2dDigit(digitOf(draw, left), digitOf(draw, right)));
    add(`MP-ACKE${N}`, "mixProduct", 21, "A", N, (draw) => mod10(digitOf(draw, "A") * digitOf(draw, "C") + digitOf(draw, "K") * digitOf(draw, "E")));
    add(`MP-AKCE${N}`, "mixProduct", 21, "A", N, (draw) => mod10(digitOf(draw, "A") * digitOf(draw, "K") + digitOf(draw, "C") * digitOf(draw, "E")));
    add(`MP-AECK${N}`, "mixProduct", 21, "A", N, (draw) => mod10(digitOf(draw, "A") * digitOf(draw, "E") + digitOf(draw, "C") * digitOf(draw, "K")));
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
    }
  }

  return specs;
}

export const ALL_FORMULA_SPECS = formulaSpecs();
