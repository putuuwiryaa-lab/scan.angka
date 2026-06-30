import { KOLOM, POS_INDEX, type AutoScanConfig, type AutoScanItem, type AutoScanResult, type BacktestRow, type Draw, type EngineConfig, type EngineResult, type Kolom, type KolomStat, type Posisi, type ScanMode } from "./types";

const POSISI: Posisi[] = ["A", "C", "K", "E"];
const OFFSET_LIST = [0, 1, 2, -1, -2, 3, 4, 5, -3, -4, -5];
const EXTENDED_OFFSET_LIST = [1, 2, -1, -2];
const CROSS_N_LIST = [1, 2, 3];
const COMBO_PAIRS: [Posisi, Posisi][] = [["A", "C"], ["A", "K"], ["A", "E"], ["C", "K"], ["C", "E"], ["K", "E"]];
const COMBO_TRIPLES: [Posisi, Posisi, Posisi][] = [["A", "C", "K"], ["A", "C", "E"], ["A", "K", "E"], ["C", "K", "E"]];
const TESSON_MAP = [7, 4, 9, 6, 1, 8, 3, 0, 5, 2];
const MIRROR_MAP = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

type FormulaType = "base" | "offset" | "tesson" | "tessonOffset" | "mirror" | "mirrorOffset" | "combo" | "comboOffset" | "crossCombo" | "crossDiff" | "combo3" | "diff" | "absdiff" | "total" | "totalOffset";

interface FormulaSpec {
  formula: string;
  type: FormulaType;
  typeOrder: number;
  patokanPos: Posisi;
  patokanN: number;
  compute: (draw: Draw) => number;
  computeAt?: (draws: Draw[], targetIndex: number) => number;
}

export function parseHistory(historyData: string): Draw[] {
  return historyData.trim().split(/\s+/).filter((tok) => /^\d{4}$/.test(tok));
}

function digitOf(draw: Draw, pos: Posisi): number {
  return Number(draw[POS_INDEX[pos]]);
}

function mod10(value: number): number {
  return ((value % 10) + 10) % 10;
}

function buildDeret(start: number): number[] {
  return Array.from({ length: 10 }, (_, i) => (start + i) % 10);
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function scanModeOrDefault(value: unknown): ScanMode {
  return value === "ai_2d_belakang" || value === "bbfs_2d_belakang" ? value : "posisi";
}

function uniqueDigits(digits: number[]): number[] {
  return [...new Set(digits.filter((digit) => Number.isFinite(digit)))];
}

function targetDigitsOf(draw: Draw, mode: ScanMode, targetPos: Posisi): number[] {
  if (mode === "ai_2d_belakang" || mode === "bbfs_2d_belakang") {
    return uniqueDigits([digitOf(draw, "K"), digitOf(draw, "E")]);
  }
  return [digitOf(draw, targetPos)];
}

function offsetSuffix(offset: number): string {
  return `${offset > 0 ? "+" : ""}${offset}`;
}

function offsetLabel(pos: Posisi, N: number, offset: number): string {
  if (offset === 0) return `${pos}${N}`;
  return `${pos}${N}${offsetSuffix(offset)}`;
}

function scanCode(target: Posisi, formula: string, L: number, columns: string, mode: ScanMode): string {
  const prefix = mode === "ai_2d_belakang" ? "ai2db" : mode === "bbfs_2d_belakang" ? "bbfs2db" : target.toLowerCase();
  return `#${prefix}_${formula}_L${L}-P0-D0_${columns || "-"}`;
}

function normalizedDigitSet(digits: number[]): string {
  return [...new Set(digits)].sort((a, b) => a - b).join("");
}

function digitsFromDeretColumns(deret: number[], columns: Kolom[]): number[] {
  return columns
    .map((column) => deret[KOLOM.indexOf(column)])
    .filter((digit): digit is number => Number.isFinite(digit));
}

function trekSignature(item: AutoScanItem): string {
  const rows = item.result.rows.map((row) => normalizedDigitSet(digitsFromDeretColumns(row.deret, item.kolomHidup)));
  const live = normalizedDigitSet(item.angkaHidup);
  return `${item.scanMode}:${item.targetPos}:${rows.join("|")}:${live}`;
}

function computeFormula(spec: FormulaSpec, draws: Draw[], targetIndex: number): number {
  if (spec.computeAt) return spec.computeAt(draws, targetIndex);
  return spec.compute(draws[targetIndex - spec.patokanN]);
}

function formulaSpecs(): FormulaSpec[] {
  const specs: FormulaSpec[] = [];

  for (let N = 1; N <= 9; N += 1) {
    for (const pos of POSISI) {
      for (const offset of OFFSET_LIST) {
        specs.push({
          formula: offsetLabel(pos, N, offset),
          type: offset === 0 ? "base" : "offset",
          typeOrder: offset === 0 ? 0 : 1,
          patokanPos: pos,
          patokanN: N,
          compute: (draw) => mod10(digitOf(draw, pos) + offset),
        });
      }

      specs.push({
        formula: `TS-${pos}${N}`,
        type: "tesson",
        typeOrder: 2,
        patokanPos: pos,
        patokanN: N,
        compute: (draw) => TESSON_MAP[digitOf(draw, pos)],
      });

      for (const offset of EXTENDED_OFFSET_LIST) {
        specs.push({
          formula: `TS-${pos}${N}${offsetSuffix(offset)}`,
          type: "tessonOffset",
          typeOrder: 3,
          patokanPos: pos,
          patokanN: N,
          compute: (draw) => mod10(TESSON_MAP[digitOf(draw, pos)] + offset),
        });
      }

      specs.push({
        formula: `M-${pos}${N}`,
        type: "mirror",
        typeOrder: 4,
        patokanPos: pos,
        patokanN: N,
        compute: (draw) => MIRROR_MAP[digitOf(draw, pos)],
      });

      for (const offset of EXTENDED_OFFSET_LIST) {
        specs.push({
          formula: `M-${pos}${N}${offsetSuffix(offset)}`,
          type: "mirrorOffset",
          typeOrder: 5,
          patokanPos: pos,
          patokanN: N,
          compute: (draw) => mod10(MIRROR_MAP[digitOf(draw, pos)] + offset),
        });
      }
    }

    for (const [left, right] of COMBO_PAIRS) {
      specs.push({
        formula: `${left}${N}+${right}${N}`,
        type: "combo",
        typeOrder: 6,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => mod10(digitOf(draw, left) + digitOf(draw, right)),
      });

      for (const offset of EXTENDED_OFFSET_LIST) {
        specs.push({
          formula: `${left}${N}+${right}${N}${offsetSuffix(offset)}`,
          type: "comboOffset",
          typeOrder: 7,
          patokanPos: left,
          patokanN: N,
          compute: (draw) => mod10(digitOf(draw, left) + digitOf(draw, right) + offset),
        });
      }
    }

    for (const [left, middle, right] of COMBO_TRIPLES) {
      specs.push({
        formula: `${left}${N}+${middle}${N}+${right}${N}`,
        type: "combo3",
        typeOrder: 10,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => mod10(digitOf(draw, left) + digitOf(draw, middle) + digitOf(draw, right)),
      });
    }

    for (const left of POSISI) {
      for (const right of POSISI) {
        if (left === right) continue;
        specs.push({
          formula: `${left}${N}-${right}${N}`,
          type: "diff",
          typeOrder: 11,
          patokanPos: left,
          patokanN: N,
          compute: (draw) => mod10(digitOf(draw, left) - digitOf(draw, right)),
        });
      }
    }

    for (const [left, right] of COMBO_PAIRS) {
      specs.push({
        formula: `D-${left}${right}${N}`,
        type: "absdiff",
        typeOrder: 12,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => Math.abs(digitOf(draw, left) - digitOf(draw, right)),
      });
    }

    specs.push({
      formula: `T${N}`,
      type: "total",
      typeOrder: 13,
      patokanPos: "A",
      patokanN: N,
      compute: (draw) => mod10(POSISI.reduce((sum, pos) => sum + digitOf(draw, pos), 0)),
    });

    for (const offset of EXTENDED_OFFSET_LIST) {
      specs.push({
        formula: `T${N}${offsetSuffix(offset)}`,
        type: "totalOffset",
        typeOrder: 14,
        patokanPos: "A",
        patokanN: N,
        compute: (draw) => mod10(POSISI.reduce((sum, pos) => sum + digitOf(draw, pos), 0) + offset),
      });
    }
  }

  for (const [left, right] of COMBO_PAIRS) {
    for (const leftN of CROSS_N_LIST) {
      for (const rightN of CROSS_N_LIST) {
        if (leftN === rightN) continue;
        specs.push({
          formula: `${left}${leftN}+${right}${rightN}`,
          type: "crossCombo",
          typeOrder: 8,
          patokanPos: left,
          patokanN: Math.max(leftN, rightN),
          compute: () => 0,
          computeAt: (draws, targetIndex) => mod10(digitOf(draws[targetIndex - leftN], left) + digitOf(draws[targetIndex - rightN], right)),
        });
      }
    }
  }

  for (const left of POSISI) {
    for (const right of POSISI) {
      if (left === right) continue;
      for (const leftN of CROSS_N_LIST) {
        for (const rightN of CROSS_N_LIST) {
          if (leftN === rightN) continue;
          specs.push({
            formula: `${left}${leftN}-${right}${rightN}`,
            type: "crossDiff",
            typeOrder: 9,
            patokanPos: left,
            patokanN: Math.max(leftN, rightN),
            compute: () => 0,
            computeAt: (draws, targetIndex) => mod10(digitOf(draws[targetIndex - leftN], left) - digitOf(draws[targetIndex - rightN], right)),
          });
        }
      }
    }
  }

  return specs;
}

function rowTargetColumns(row: BacktestRow): Kolom[] {
  const columns = uniqueDigits(row.targetDigits).map((digit) => KOLOM[(digit - row.patokan + 10) % 10]);
  return [...new Set(columns)];
}

function selectedColumnsForAi(result: EngineResult, digitCount: number): Kolom[] {
  const selected: Kolom[] = [];
  const uncovered = new Set(result.rows.map((_, index) => index));

  while (uncovered.size > 0) {
    let best: Kolom | null = null;
    let bestCover = -1;
    let bestHit = -1;

    for (const column of KOLOM) {
      if (selected.includes(column)) continue;
      const cover = [...uncovered].filter((rowIndex) => rowTargetColumns(result.rows[rowIndex]).includes(column)).length;
      const hit = result.kolom.find((k) => k.kolom === column)?.hit ?? 0;
      if (cover > bestCover || (cover === bestCover && hit > bestHit)) {
        best = column;
        bestCover = cover;
        bestHit = hit;
      }
    }

    if (!best || bestCover <= 0) return [];
    selected.push(best);
    for (const rowIndex of [...uncovered]) {
      if (rowTargetColumns(result.rows[rowIndex]).includes(best)) uncovered.delete(rowIndex);
    }
    if (selected.length > digitCount) return [];
  }

  const padding = KOLOM
    .filter((column) => !selected.includes(column))
    .sort((a, b) => {
      const hitA = result.kolom.find((k) => k.kolom === a)?.hit ?? 0;
      const hitB = result.kolom.find((k) => k.kolom === b)?.hit ?? 0;
      return hitB - hitA || KOLOM.indexOf(a) - KOLOM.indexOf(b);
    });

  return [...selected, ...padding].slice(0, digitCount);
}

function selectedColumns(result: EngineResult, digitCount: number, scanMode: ScanMode): Kolom[] {
  if (scanMode === "ai_2d_belakang") return selectedColumnsForAi(result, digitCount);
  const alive = result.kolom.filter((k) => !k.lemah).map((k) => k.kolom as Kolom);
  if (alive.length > digitCount) return [];
  const padding = result.kolom.filter((k) => k.lemah).map((k) => k.kolom as Kolom);
  return [...alive, ...padding].slice(0, digitCount);
}

function digitsFromColumns(result: EngineResult, columns: Kolom[]): number[] {
  return columns
    .map((column) => result.kolom.find((k) => k.kolom === column)?.digitLive)
    .filter((digit): digit is number => Number.isFinite(digit));
}

function runFormulaEngine(draws: Draw[], spec: FormulaSpec, targetPos: Posisi, L: number, scanMode: ScanMode): EngineResult {
  const N = spec.patokanN;
  if (!POSISI.includes(spec.patokanPos) || !POSISI.includes(targetPos)) throw new Error("Posisi tidak valid.");
  if (N < 1 || N > 9) throw new Error(`patokanN harus 1-9, diterima ${N}`);
  if (draws.length <= N) throw new Error(`Data tidak cukup: butuh > ${N} hasil, hanya ada ${draws.length}.`);

  const validTargets: number[] = [];
  for (let t = N; t < draws.length; t++) validTargets.push(t);

  const safeL = clamp(L, 14, 1, 100);
  const targets = validTargets.slice(-safeL);
  const hit = new Array(10).fill(0);
  const rows: BacktestRow[] = [];

  for (const t of targets) {
    const sourceIndex = t - N;
    const displayIndex = t - 1;
    const patokan = computeFormula(spec, draws, t);
    const deret = buildDeret(patokan);
    const targetDigits = targetDigitsOf(draws[t], scanMode, targetPos);
    const targetDigit = targetDigits[0];
    const hitColumns = uniqueDigits(targetDigits).map((digit) => (digit - patokan + 10) % 10);
    for (const col of hitColumns) hit[col] += 1;
    rows.push({
      displayDraw: draws[displayIndex],
      patokanDraw: draws[sourceIndex],
      targetDraw: draws[t],
      patokan,
      deret,
      targetDigit,
      targetDigits,
      kolomKena: KOLOM[hitColumns[0]],
    });
  }

  const latestDraw = draws[draws.length - 1];
  const patokanLiveDraw = draws[draws.length - N];
  const deretLive = buildDeret(computeFormula(spec, draws, draws.length));
  const kolom: KolomStat[] = KOLOM.map((k, i) => ({ kolom: k, hit: hit[i], lemah: hit[i] === 0, digitLive: deretLive[i] }));
  const angkaMati = kolom.filter((k) => k.lemah).map((k) => k.digitLive);
  const angkaKuat = kolom.filter((k) => !k.lemah).map((k) => k.digitLive);

  return {
    config: { patokanPos: spec.patokanPos, patokanN: N, targetPos, L: safeL, scanMode },
    jumlahData: draws.length,
    jumlahBacktest: targets.length,
    kolom,
    deretLive,
    patokanLiveDraw,
    latestDraw,
    angkaKuat,
    angkaMati,
    rows,
  };
}

export function runEngine(draws: Draw[], config: EngineConfig): EngineResult {
  const { patokanPos, patokanN, targetPos, L } = config;
  const scanMode = scanModeOrDefault(config.scanMode);
  const spec: FormulaSpec = {
    formula: `${patokanPos}${patokanN}`,
    type: "base",
    typeOrder: 0,
    patokanPos,
    patokanN,
    compute: (draw) => digitOf(draw, patokanPos),
  };
  return runFormulaEngine(draws, spec, targetPos, L, scanMode);
}

export function runEngineFromHistory(historyData: string, config: EngineConfig): EngineResult {
  return runEngine(parseHistory(historyData), config);
}

export function runAutoScan(draws: Draw[], config: AutoScanConfig): AutoScanResult {
  const safeConfig = {
    L: clamp(config.L, 14, 1, 100),
    targetPos: config.targetPos || "K",
    digitCount: clamp(config.digitCount, 3, 1, 9),
    stopScan: clamp(config.stopScan, 3, 1, 200),
    scanMode: scanModeOrDefault(config.scanMode),
  };
  const targets = safeConfig.scanMode === "posisi" ? (config.targetPos ? [config.targetPos] : POSISI) : ["K" as Posisi];
  const items: (AutoScanItem & { typeOrder: number; strength: number })[] = [];
  let totalChecked = 0;
  const specs = formulaSpecs();

  for (const targetPos of targets) {
    for (const spec of specs) {
      totalChecked += 1;
      const result = runFormulaEngine(draws, spec, targetPos, safeConfig.L, safeConfig.scanMode);
      const columns = selectedColumns(result, safeConfig.digitCount, safeConfig.scanMode);
      if (columns.length !== safeConfig.digitCount) continue;

      const columnSet = new Set<Kolom>(columns);
      const angkaHidup = digitsFromColumns(result, columns);
      const kolomMati = result.kolom.filter((k) => !columnSet.has(k.kolom as Kolom)).map((k) => k.kolom as Kolom);
      const angkaMati = result.kolom.filter((k) => !columnSet.has(k.kolom as Kolom)).map((k) => k.digitLive);

      items.push({
        targetPos,
        scanMode: safeConfig.scanMode,
        patokanPos: spec.patokanPos,
        patokanN: spec.patokanN,
        formula: spec.formula,
        code: scanCode(targetPos, spec.formula, safeConfig.L, columns.join(""), safeConfig.scanMode),
        angkaHidup,
        kolomHidup: columns,
        angkaMati,
        kolomMati,
        activeColumns: columns.join(""),
        jumlahHidup: angkaHidup.length,
        result,
        typeOrder: spec.typeOrder,
        strength: safeConfig.scanMode === "ai_2d_belakang" ? columns.length : result.angkaKuat.length,
      });
    }
  }

  const sorted = items.sort((a, b) => {
    const strength = a.strength - b.strength;
    if (strength !== 0) return strength;
    const typeOrder = a.typeOrder - b.typeOrder;
    if (typeOrder !== 0) return typeOrder;
    const targetOrder = POSISI.indexOf(a.targetPos) - POSISI.indexOf(b.targetPos);
    if (targetOrder !== 0) return targetOrder;
    const sourceOrder = POSISI.indexOf(a.patokanPos) - POSISI.indexOf(b.patokanPos);
    if (sourceOrder !== 0) return sourceOrder;
    if (a.patokanN !== b.patokanN) return a.patokanN - b.patokanN;
    return a.formula.localeCompare(b.formula);
  });
  const seen = new Set<string>();
  const unique = [] as (AutoScanItem & { typeOrder: number; strength: number })[];

  for (const item of sorted) {
    const signature = trekSignature(item);
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(item);
    if (unique.length >= safeConfig.stopScan) break;
  }

  const limited = unique.map(({ typeOrder, strength, ...item }) => item);

  return { config: safeConfig, totalChecked, totalMatched: limited.length, items: limited };
}

export function runAutoScanFromHistory(historyData: string, config: AutoScanConfig): AutoScanResult {
  return runAutoScan(parseHistory(historyData), config);
}
