import { KOLOM, POS_INDEX, type AutoScanConfig, type AutoScanItem, type AutoScanResult, type BacktestRow, type Draw, type EngineConfig, type EngineResult, type Kolom, type KolomStat, type Posisi } from "./types";

const POSISI: Posisi[] = ["A", "C", "K", "E"];
const OFFSET_LIST = [0, 1, 2, -1, -2];
const COMBO_PAIRS: [Posisi, Posisi][] = [["A", "C"], ["A", "K"], ["A", "E"], ["C", "K"], ["C", "E"], ["K", "E"]];

type FormulaType = "base" | "offset" | "combo" | "diff" | "total";

interface FormulaSpec {
  formula: string;
  type: FormulaType;
  typeOrder: number;
  patokanPos: Posisi;
  patokanN: number;
  compute: (draw: Draw) => number;
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

function offsetLabel(pos: Posisi, N: number, offset: number): string {
  if (offset === 0) return `${pos}${N}`;
  return `${pos}${N}${offset > 0 ? "+" : ""}${offset}`;
}

function scanCode(target: Posisi, formula: string, L: number, columns: string): string {
  return `#${target.toLowerCase()}_${formula}_L${L}-P0-D0_${columns || "-"}`;
}

function digitSignature(targetPos: Posisi, digits: number[]): string {
  const normalized = [...new Set(digits)].sort((a, b) => a - b).join("");
  return `${targetPos}:${normalized}`;
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
    }

    for (const [left, right] of COMBO_PAIRS) {
      specs.push({
        formula: `${left}${N}+${right}${N}`,
        type: "combo",
        typeOrder: 2,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => mod10(digitOf(draw, left) + digitOf(draw, right)),
      });
    }

    for (const left of POSISI) {
      for (const right of POSISI) {
        if (left === right) continue;
        specs.push({
          formula: `${left}${N}-${right}${N}`,
          type: "diff",
          typeOrder: 3,
          patokanPos: left,
          patokanN: N,
          compute: (draw) => mod10(digitOf(draw, left) - digitOf(draw, right)),
        });
      }
    }

    specs.push({
      formula: `T${N}`,
      type: "total",
      typeOrder: 4,
      patokanPos: "A",
      patokanN: N,
      compute: (draw) => mod10(POSISI.reduce((sum, pos) => sum + digitOf(draw, pos), 0)),
    });
  }

  return specs;
}

function selectedColumns(result: EngineResult, digitCount: number): Kolom[] {
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

function runFormulaEngine(draws: Draw[], spec: FormulaSpec, targetPos: Posisi, L: number): EngineResult {
  const N = spec.patokanN;
  if (!POSISI.includes(spec.patokanPos) || !POSISI.includes(targetPos)) throw new Error("Posisi tidak valid.");
  if (N < 1 || N > 9) throw new Error(`patokanN harus 1-9, diterima ${N}`);
  if (draws.length <= N) throw new Error(`Data tidak cukup: butuh > ${N} hasil, hanya ada ${draws.length}.`);

  const validTargets: number[] = [];
  for (let t = N; t < draws.length; t++) validTargets.push(t);

  const safeL = clamp(L, 15, 1, 100);
  const targets = validTargets.slice(-safeL);
  const hit = new Array(10).fill(0);
  const rows: BacktestRow[] = [];

  for (const t of targets) {
    const sourceIndex = t - N;
    const displayIndex = t - 1;
    const patokan = spec.compute(draws[sourceIndex]);
    const deret = buildDeret(patokan);
    const targetDigit = digitOf(draws[t], targetPos);
    const col = (targetDigit - patokan + 10) % 10;
    hit[col] += 1;
    rows.push({
      displayDraw: draws[displayIndex],
      patokanDraw: draws[sourceIndex],
      targetDraw: draws[t],
      patokan,
      deret,
      targetDigit,
      kolomKena: KOLOM[col],
    });
  }

  const latestDraw = draws[draws.length - 1];
  const patokanLiveDraw = draws[draws.length - N];
  const deretLive = buildDeret(spec.compute(patokanLiveDraw));
  const kolom: KolomStat[] = KOLOM.map((k, i) => ({ kolom: k, hit: hit[i], lemah: hit[i] === 0, digitLive: deretLive[i] }));
  const angkaMati = kolom.filter((k) => k.lemah).map((k) => k.digitLive);
  const angkaKuat = kolom.filter((k) => !k.lemah).map((k) => k.digitLive);

  return {
    config: { patokanPos: spec.patokanPos, patokanN: N, targetPos, L: safeL },
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
  const spec: FormulaSpec = {
    formula: `${patokanPos}${patokanN}`,
    type: "base",
    typeOrder: 0,
    patokanPos,
    patokanN,
    compute: (draw) => digitOf(draw, patokanPos),
  };
  return runFormulaEngine(draws, spec, targetPos, L);
}

export function runEngineFromHistory(historyData: string, config: EngineConfig): EngineResult {
  return runEngine(parseHistory(historyData), config);
}

export function runAutoScan(draws: Draw[], config: AutoScanConfig): AutoScanResult {
  const safeConfig = {
    L: clamp(config.L, 15, 1, 100),
    targetPos: config.targetPos || "K",
    digitCount: clamp(config.digitCount, 3, 1, 9),
    stopScan: clamp(config.stopScan, 3, 1, 200),
  };
  const targets = config.targetPos ? [config.targetPos] : POSISI;
  const items: (AutoScanItem & { typeOrder: number; strength: number })[] = [];
  let totalChecked = 0;
  const specs = formulaSpecs();

  for (const targetPos of targets) {
    for (const spec of specs) {
      totalChecked += 1;
      const result = runFormulaEngine(draws, spec, targetPos, safeConfig.L);
      const columns = selectedColumns(result, safeConfig.digitCount);
      if (columns.length !== safeConfig.digitCount) continue;

      const columnSet = new Set<Kolom>(columns);
      const angkaHidup = digitsFromColumns(result, columns);
      const kolomMati = result.kolom.filter((k) => !columnSet.has(k.kolom as Kolom)).map((k) => k.kolom as Kolom);
      const angkaMati = result.kolom.filter((k) => !columnSet.has(k.kolom as Kolom)).map((k) => k.digitLive);

      items.push({
        targetPos,
        patokanPos: spec.patokanPos,
        patokanN: spec.patokanN,
        formula: spec.formula,
        code: scanCode(targetPos, spec.formula, safeConfig.L, columns.join("")),
        angkaHidup,
        kolomHidup: columns,
        angkaMati,
        kolomMati,
        activeColumns: columns.join(""),
        jumlahHidup: angkaHidup.length,
        result,
        typeOrder: spec.typeOrder,
        strength: result.angkaKuat.length,
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
    const signature = digitSignature(item.targetPos, item.angkaHidup);
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
