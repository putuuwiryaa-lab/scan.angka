import { KOLOM, POS_INDEX, type AutoScanConfig, type AutoScanItem, type AutoScanResult, type BacktestRow, type Draw, type EngineConfig, type EngineResult, type Kolom, type KolomStat, type Posisi, type ScanMode } from "./types";

const POSISI: Posisi[] = ["A", "C", "K", "E"];
const OFFSET_LIST = [0, 1, 2, -1, -2, 3, 4, 5, -3, -4, -5];
const EXTENDED_OFFSET_LIST = [1, 2, -1, -2];
const CROSS_N_LIST = [1, 2, 3];
const COMBO_PAIRS: [Posisi, Posisi][] = [["A", "C"], ["A", "K"], ["A", "E"], ["C", "K"], ["C", "E"], ["K", "E"]];
const COMBO_TRIPLES: [Posisi, Posisi, Posisi][] = [["A", "C", "K"], ["A", "C", "E"], ["A", "K", "E"], ["C", "K", "E"]];
const TESSON_MAP = [7, 4, 9, 6, 1, 8, 3, 0, 5, 2];
const MIRROR_MAP = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const DEFAULT_DIGIT_COUNT = 7;

type FormulaType = "base" | "offset" | "tesson" | "tessonOffset" | "mirror" | "mirrorOffset" | "combo" | "comboOffset" | "crossCombo" | "crossDiff" | "tessonCombo" | "mirrorCombo" | "combo3" | "diff" | "absdiff" | "total" | "totalOffset";

type RankedItem = AutoScanItem & { typeOrder: number; strength: number; rankCoreSize: number; hitScore: number; recentScore: number; consensusOverlap: number; consensusWeight: number; consensusDigits: number[] };

interface FormulaSpec {
  formula: string;
  type: FormulaType;
  typeOrder: number;
  patokanPos: Posisi;
  patokanN: number;
  compute: (draw: Draw) => number;
  computeAt?: (draws: Draw[], targetIndex: number) => number;
}

interface SupportPick {
  column: Kolom;
  score: number;
  ownHit: number;
  reason: string;
}

interface ConsensusProfile {
  digits: number[];
  counts: number[];
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
  return value === "ai_2d_belakang" || value === "bbfs_2d_belakang" || value === "jumlah_2d_belakang" ? value : "posisi";
}

function uniqueDigits(digits: number[]): number[] {
  return [...new Set(digits.filter((digit) => Number.isFinite(digit)))];
}

function jumlah2dDigit(left: number, right: number): number {
  const total = left + right;
  return total >= 10 ? Math.floor(total / 10) + (total % 10) : total;
}

function targetDigitsOf(draw: Draw, mode: ScanMode, targetPos: Posisi): number[] {
  if (mode === "ai_2d_belakang" || mode === "bbfs_2d_belakang") return uniqueDigits([digitOf(draw, "K"), digitOf(draw, "E")]);
  if (mode === "jumlah_2d_belakang") return [jumlah2dDigit(digitOf(draw, "K"), digitOf(draw, "E"))];
  return [digitOf(draw, targetPos)];
}

function offsetSuffix(offset: number): string {
  return `${offset > 0 ? "+" : ""}${offset}`;
}

function offsetLabel(pos: Posisi, N: number, offset: number): string {
  return offset === 0 ? `${pos}${N}` : `${pos}${N}${offsetSuffix(offset)}`;
}

function scanCode(target: Posisi, formula: string, L: number, columns: string, mode: ScanMode): string {
  const prefix = mode === "ai_2d_belakang" ? "ai2db" : mode === "bbfs_2d_belakang" ? "bbfs2db" : mode === "jumlah_2d_belakang" ? "jml2db" : target.toLowerCase();
  return `#${prefix}_${formula}_L${L}-P0-D0_${columns || "-"}`;
}

function digitsFromDeretColumns(deret: number[], columns: Kolom[]): number[] {
  return columns.map((column) => deret[KOLOM.indexOf(column)]).filter((digit): digit is number => Number.isFinite(digit));
}

function trekSignature(item: AutoScanItem): string {
  const rows = item.result.rows.map((row) => digitsFromDeretColumns(row.deret, item.kolomHidup).join(""));
  return `${item.scanMode}:${item.targetPos}:${rows.join("|")}`;
}

function computeFormula(spec: FormulaSpec, draws: Draw[], targetIndex: number): number {
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
    }

    for (const [left, middle, right] of COMBO_TRIPLES) add(`${left}${N}+${middle}${N}+${right}${N}`, "combo3", 12, left, N, (draw) => mod10(digitOf(draw, left) + digitOf(draw, middle) + digitOf(draw, right)));
    for (const left of POSISI) for (const right of POSISI) if (left !== right) add(`${left}${N}-${right}${N}`, "diff", 13, left, N, (draw) => mod10(digitOf(draw, left) - digitOf(draw, right)));
    for (const [left, right] of COMBO_PAIRS) add(`D-${left}${right}${N}`, "absdiff", 14, left, N, (draw) => Math.abs(digitOf(draw, left) - digitOf(draw, right)));
    add(`T${N}`, "total", 15, "A", N, (draw) => mod10(POSISI.reduce((sum, pos) => sum + digitOf(draw, pos), 0)));
    for (const offset of EXTENDED_OFFSET_LIST) add(`T${N}${offsetSuffix(offset)}`, "totalOffset", 16, "A", N, (draw) => mod10(POSISI.reduce((sum, pos) => sum + digitOf(draw, pos), 0) + offset));
  }

  for (const [left, right] of COMBO_PAIRS) {
    for (const leftN of CROSS_N_LIST) {
      for (const rightN of CROSS_N_LIST) {
        if (leftN === rightN) continue;
        add(`${left}${leftN}+${right}${rightN}`, "crossCombo", 8, left, Math.max(leftN, rightN), () => 0, (draws, targetIndex) => mod10(digitOf(draws[targetIndex - leftN], left) + digitOf(draws[targetIndex - rightN], right)));
      }
    }
  }

  for (const left of POSISI) {
    for (const right of POSISI) {
      if (left === right) continue;
      for (const leftN of CROSS_N_LIST) {
        for (const rightN of CROSS_N_LIST) {
          if (leftN === rightN) continue;
          add(`${left}${leftN}-${right}${rightN}`, "crossDiff", 9, left, Math.max(leftN, rightN), () => 0, (draws, targetIndex) => mod10(digitOf(draws[targetIndex - leftN], left) - digitOf(draws[targetIndex - rightN], right)));
        }
      }
    }
  }

  return specs;
}

const ALL_FORMULA_SPECS = formulaSpecs();

function rowTargetColumns(row: BacktestRow): Kolom[] {
  const columns = uniqueDigits(row.targetDigits).map((digit) => KOLOM[(digit - row.patokan + 10) % 10]);
  return [...new Set(columns)];
}

function columnHit(result: EngineResult, column: Kolom): number {
  return result.kolom.find((k) => k.kolom === column)?.hit ?? 0;
}

function columnDigit(result: EngineResult, column: Kolom): number {
  return result.kolom.find((k) => k.kolom === column)?.digitLive ?? -1;
}

function columnsHitScore(result: EngineResult, columns: Kolom[]): number {
  return columns.reduce((sum, column) => sum + columnHit(result, column), 0);
}

function adjacentColumn(column: Kolom, direction: -1 | 1): Kolom {
  const index = KOLOM.indexOf(column);
  return KOLOM[(index + direction + KOLOM.length) % KOLOM.length];
}

function supportCandidate(result: EngineResult, column: Kolom, coreSet: Set<Kolom>): SupportPick {
  const left = adjacentColumn(column, -1);
  const right = adjacentColumn(column, 1);
  const leftHit = coreSet.has(left) ? columnHit(result, left) : 0;
  const rightHit = coreSet.has(right) ? columnHit(result, right) : 0;
  const ownHit = columnHit(result, column);
  const bridgeBonus = leftHit > 0 && rightHit > 0 ? 25 : 0;
  const score = (leftHit + rightHit) * 100 + bridgeBonus + ownHit * 10;
  const digit = columnDigit(result, column);

  if (leftHit > 0 && rightHit > 0) return { column, score, ownHit, reason: `${column}(${digit}) dipilih karena menjembatani ${left}(${leftHit}x) dan ${right}(${rightHit}x)` };
  if (leftHit > 0) return { column, score, ownHit, reason: `${column}(${digit}) dipilih karena menempel ${left}(${leftHit}x)` };
  if (rightHit > 0) return { column, score, ownHit, reason: `${column}(${digit}) dipilih karena menempel ${right}(${rightHit}x)` };
  if (ownHit > 0) return { column, score, ownHit, reason: `${column}(${digit}) dipilih karena punya hit ${ownHit}x pada rumus ini` };
  return { column, score, ownHit, reason: `${column}(${digit}) dipilih sebagai cadangan terdekat yang tersedia pada deret rumus` };
}

function supportFill(result: EngineResult, coreColumns: Kolom[], digitCount: number): { columns: Kolom[]; supportColumns: Kolom[]; supportReasons: string[] } | null {
  if (coreColumns.length > digitCount) return null;
  const coreSet = new Set(coreColumns);
  const needed = digitCount - coreColumns.length;
  const supports = KOLOM
    .filter((column) => !coreSet.has(column))
    .map((column) => supportCandidate(result, column, coreSet))
    .sort((a, b) => b.score - a.score || b.ownHit - a.ownHit || KOLOM.indexOf(a.column) - KOLOM.indexOf(b.column))
    .slice(0, needed);
  if (supports.length !== needed) return null;
  return { columns: [...coreColumns, ...supports.map((item) => item.column)], supportColumns: supports.map((item) => item.column), supportReasons: supports.map((item) => item.reason) };
}

function coreColumnsForAi(result: EngineResult, digitCount: number): Kolom[] {
  const selected: Kolom[] = [];
  const uncovered = new Set(result.rows.map((_, index) => index));
  while (uncovered.size > 0) {
    let best: Kolom | null = null;
    let bestCover = -1;
    let bestHit = -1;
    for (const column of KOLOM) {
      if (selected.includes(column)) continue;
      const cover = [...uncovered].filter((rowIndex) => rowTargetColumns(result.rows[rowIndex]).includes(column)).length;
      const hit = columnHit(result, column);
      if (cover > bestCover || (cover === bestCover && hit > bestHit)) {
        best = column;
        bestCover = cover;
        bestHit = hit;
      }
    }
    if (!best || bestCover <= 0) return [];
    selected.push(best);
    for (const rowIndex of [...uncovered]) if (rowTargetColumns(result.rows[rowIndex]).includes(best)) uncovered.delete(rowIndex);
    if (selected.length > digitCount) return [];
  }
  return selected;
}

function coreColumns(result: EngineResult, digitCount: number, scanMode: ScanMode): Kolom[] {
  if (scanMode === "ai_2d_belakang") return coreColumnsForAi(result, digitCount);
  const alive = result.kolom.filter((k) => !k.lemah).map((k) => k.kolom as Kolom);
  return alive.length <= digitCount ? alive : [];
}

function selectedColumns(result: EngineResult, digitCount: number, scanMode: ScanMode): Kolom[] {
  const core = coreColumns(result, digitCount, scanMode);
  const filled = supportFill(result, core, digitCount);
  return filled?.columns ?? [];
}

function rowCovered(row: BacktestRow, columns: Set<Kolom>, scanMode: ScanMode): boolean {
  const targetColumns = rowTargetColumns(row);
  return scanMode === "ai_2d_belakang" ? targetColumns.some((column) => columns.has(column)) : targetColumns.every((column) => columns.has(column));
}

function recentScore(result: EngineResult, columns: Kolom[], scanMode: ScanMode): number {
  const columnSet = new Set(columns);
  return result.rows.slice(-5).filter((row) => rowCovered(row, columnSet, scanMode)).length;
}

function compressionProfile(result: EngineResult, digitCount: number, scanMode: ScanMode): { displayColumns: Kolom[]; coreColumns: Kolom[]; supportColumns: Kolom[]; supportReasons: string[]; coreSize: number; hitScore: number; recentScore: number } | null {
  const core = coreColumns(result, digitCount, scanMode);
  if (core.length === 0 || core.length > digitCount) return null;
  const minCore = Math.max(1, digitCount - 2);
  const coreSize = Math.max(core.length, minCore);
  if (!supportFill(result, core, coreSize)) return null;
  const display = supportFill(result, core, digitCount);
  if (!display) return null;
  return { displayColumns: display.columns, coreColumns: core, supportColumns: display.supportColumns, supportReasons: display.supportReasons, coreSize, hitScore: columnsHitScore(result, core), recentScore: recentScore(result, core, scanMode) };
}

function digitsFromColumns(result: EngineResult, columns: Kolom[]): number[] {
  return columns.map((column) => result.kolom.find((k) => k.kolom === column)?.digitLive).filter((digit): digit is number => Number.isFinite(digit));
}

function consensusProfile(items: AutoScanItem[], digitCount: number): ConsensusProfile {
  const counts = Array.from({ length: 10 }, () => 0);
  for (const item of items) {
    for (const digit of uniqueDigits(item.angkaHidup)) {
      if (digit >= 0 && digit <= 9) counts[digit] += 1;
    }
  }
  const digits = counts.map((count, digit) => ({ digit, count })).sort((a, b) => b.count - a.count || a.digit - b.digit).slice(0, digitCount).map((item) => item.digit);
  return { digits, counts };
}

function applyConsensusScores(items: RankedItem[], digitCount: number): void {
  const coreGroups = new Map<number, RankedItem[]>();
  for (const item of items) coreGroups.set(item.rankCoreSize, [...(coreGroups.get(item.rankCoreSize) ?? []), item]);

  for (const group of coreGroups.values()) {
    const profile = consensusProfile(group, digitCount);
    const consensusSet = new Set(profile.digits);
    for (const item of group) {
      const digits = uniqueDigits(item.angkaHidup);
      item.consensusDigits = profile.digits;
      item.consensusOverlap = digits.filter((digit) => consensusSet.has(digit)).length;
      item.consensusWeight = digits.reduce((sum, digit) => sum + (profile.counts[digit] ?? 0), 0);
    }
  }
}

function baseRank(a: RankedItem, b: RankedItem): number {
  return a.rankCoreSize - b.rankCoreSize ||
    b.recentScore - a.recentScore ||
    b.hitScore - a.hitScore ||
    a.typeOrder - b.typeOrder ||
    POSISI.indexOf(a.targetPos) - POSISI.indexOf(b.targetPos) ||
    POSISI.indexOf(a.patokanPos) - POSISI.indexOf(b.patokanPos) ||
    a.patokanN - b.patokanN ||
    a.formula.localeCompare(b.formula);
}

function finalRank(a: RankedItem, b: RankedItem): number {
  return a.rankCoreSize - b.rankCoreSize ||
    b.consensusOverlap - a.consensusOverlap ||
    b.consensusWeight - a.consensusWeight ||
    b.recentScore - a.recentScore ||
    b.hitScore - a.hitScore ||
    a.typeOrder - b.typeOrder ||
    POSISI.indexOf(a.targetPos) - POSISI.indexOf(b.targetPos) ||
    POSISI.indexOf(a.patokanPos) - POSISI.indexOf(b.patokanPos) ||
    a.patokanN - b.patokanN ||
    a.formula.localeCompare(b.formula);
}

function dedupeTrekCandidates(items: RankedItem[]): RankedItem[] {
  const seen = new Set<string>();
  const unique: RankedItem[] = [];
  for (const item of [...items].sort(baseRank)) {
    const signature = trekSignature(item);
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(item);
  }
  return unique;
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
    rows.push({ displayDraw: draws[displayIndex], patokanDraw: draws[sourceIndex], targetDraw: draws[t], patokan, deret, targetDigit, targetDigits, kolomKena: KOLOM[hitColumns[0]] });
  }
  const latestDraw = draws[draws.length - 1];
  const patokanLiveDraw = draws[draws.length - N];
  const deretLive = buildDeret(computeFormula(spec, draws, draws.length));
  const kolom: KolomStat[] = KOLOM.map((k, i) => ({ kolom: k, hit: hit[i], lemah: hit[i] === 0, digitLive: deretLive[i] }));
  const angkaMati = kolom.filter((k) => k.lemah).map((k) => k.digitLive);
  const angkaKuat = kolom.filter((k) => !k.lemah).map((k) => k.digitLive);
  return { config: { patokanPos: spec.patokanPos, patokanN: N, targetPos, L: safeL, scanMode }, jumlahData: draws.length, jumlahBacktest: targets.length, kolom, deretLive, patokanLiveDraw, latestDraw, angkaKuat, angkaMati, rows };
}

export function runEngine(draws: Draw[], config: EngineConfig): EngineResult {
  const { patokanPos, patokanN, targetPos, L } = config;
  const scanMode = scanModeOrDefault(config.scanMode);
  return runFormulaEngine(draws, { formula: `${patokanPos}${patokanN}`, type: "base", typeOrder: 0, patokanPos, patokanN, compute: (draw) => digitOf(draw, patokanPos) }, targetPos, L, scanMode);
}

export function runEngineFromHistory(historyData: string, config: EngineConfig): EngineResult {
  return runEngine(parseHistory(historyData), config);
}

export function runAutoScan(draws: Draw[], config: AutoScanConfig): AutoScanResult {
  const safeConfig = { L: clamp(config.L, 14, 1, 100), targetPos: config.targetPos || "K", digitCount: clamp(config.digitCount, DEFAULT_DIGIT_COUNT, 1, 9), stopScan: clamp(config.stopScan, 3, 1, 200), scanMode: scanModeOrDefault(config.scanMode) };
  const targets = safeConfig.scanMode === "posisi" ? (config.targetPos ? [config.targetPos] : POSISI) : ["K" as Posisi];
  const items: RankedItem[] = [];
  let totalChecked = 0;
  for (const targetPos of targets) {
    for (const spec of ALL_FORMULA_SPECS) {
      totalChecked += 1;
      try {
        const result = runFormulaEngine(draws, spec, targetPos, safeConfig.L, safeConfig.scanMode);
        const profile = compressionProfile(result, safeConfig.digitCount, safeConfig.scanMode);
        if (!profile) continue;
        const columns = profile.displayColumns;
        const angkaHidup = digitsFromColumns(result, columns);
        if (safeConfig.scanMode === "jumlah_2d_belakang" && angkaHidup.includes(0)) continue;
        const columnSet = new Set<Kolom>(columns);
        items.push({ targetPos, scanMode: safeConfig.scanMode, patokanPos: spec.patokanPos, patokanN: spec.patokanN, formula: spec.formula, code: scanCode(targetPos, spec.formula, safeConfig.L, columns.join(""), safeConfig.scanMode), angkaHidup, kolomHidup: columns, angkaMati: result.kolom.filter((k) => !columnSet.has(k.kolom as Kolom)).map((k) => k.digitLive), kolomMati: result.kolom.filter((k) => !columnSet.has(k.kolom as Kolom)).map((k) => k.kolom as Kolom), activeColumns: columns.join(""), jumlahHidup: columns.length, coreSize: profile.coreSize, coreColumns: profile.coreColumns, supportColumns: profile.supportColumns, supportReasons: profile.supportReasons, consensusDigits: [], consensusOverlap: 0, consensusWeight: 0, result, typeOrder: spec.typeOrder, strength: profile.coreSize, rankCoreSize: profile.coreSize, hitScore: profile.hitScore, recentScore: profile.recentScore });
      } catch {
        continue;
      }
    }
  }
  const uniqueItems = dedupeTrekCandidates(items);
  applyConsensusScores(uniqueItems, safeConfig.digitCount);
  const sorted = uniqueItems.sort(finalRank);
  const limited = sorted.slice(0, safeConfig.stopScan).map(({ typeOrder, strength, rankCoreSize, hitScore, recentScore, ...item }) => item);
  return { config: safeConfig, totalChecked, totalMatched: limited.length, items: limited };
}

export function runAutoScanFromHistory(historyData: string, config: AutoScanConfig): AutoScanResult {
  return runAutoScan(parseHistory(historyData), config);
}
