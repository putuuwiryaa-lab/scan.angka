import { KOLOM, SHIO_KOLOM, type AutoScanConfig, type AutoScanResult, type BacktestRow, type Draw, type EngineConfig, type EngineResult, type Kolom, type KolomStat, type Posisi, type ScanMode, type Target2D, type Target3D } from "./types";
import { DEFAULT_DIGIT_COUNT, POSISI } from "./constants";
import { ALL_FORMULA_SPECS, computeFormula, type FormulaSpec } from "./formulas";
import { buildDeret, buildDeretShio, clamp, digitOf, isJumlah2DMode, isShioMode, parseHistory, scanCode, scanModeOrDefault, target2DOrDefault, target3DOrDefault, targetDigitsOf, uniqueDigits } from "./helpers";
import { applyConsensusScores, compressionProfile, dedupeTrekCandidates, digitsFromColumns, finalRank, type RankedItem } from "./ranking";

export { parseHistory } from "./helpers";

function columnsForMode(scanMode: ScanMode): readonly Kolom[] {
  return isShioMode(scanMode) ? SHIO_KOLOM : KOLOM;
}

function deretForMode(start: number, scanMode: ScanMode): number[] {
  return isShioMode(scanMode) ? buildDeretShio(start) : buildDeret(start);
}

function activeColumnsText(columns: Kolom[], scanMode: ScanMode): string {
  return isShioMode(scanMode) ? columns.join(",") : columns.join("");
}

function runFormulaEngine(draws: Draw[], spec: FormulaSpec, targetPos: Posisi, L: number, scanMode: ScanMode, target2D: Target2D, target3D: Target3D): EngineResult {
  const N = spec.patokanN;
  if (!POSISI.includes(spec.patokanPos) || !POSISI.includes(targetPos)) throw new Error("Posisi tidak valid.");
  if (N < 1 || N > 9) throw new Error(`patokanN harus 1-9, diterima ${N}`);
  if (draws.length <= N) throw new Error(`Data tidak cukup: butuh > ${N} hasil, hanya ada ${draws.length}.`);

  const validTargets: number[] = [];
  for (let t = N; t < draws.length; t++) validTargets.push(t);

  const safeL = clamp(L, 14, 1, 100);
  const targets = validTargets.slice(-safeL);
  const sourceColumns = columnsForMode(scanMode);
  const hit = new Array(sourceColumns.length).fill(0);
  const rows: BacktestRow[] = [];

  for (const t of targets) {
    const sourceIndex = t - N;
    const displayIndex = t - 1;
    const patokan = computeFormula(spec, draws, t);
    const deret = deretForMode(patokan, scanMode);
    const targetDigits = targetDigitsOf(draws[t], scanMode, targetPos, target2D, target3D);
    const targetDigit = targetDigits[0];
    const hitColumns = uniqueDigits(targetDigits).map((digit) => deret.indexOf(digit)).filter((index) => index >= 0);
    for (const col of hitColumns) hit[col] += 1;
    rows.push({ displayDraw: draws[displayIndex], patokanDraw: draws[sourceIndex], targetDraw: draws[t], patokan, deret, targetDigit, targetDigits, kolomKena: sourceColumns[hitColumns[0]] });
  }

  const latestDraw = draws[draws.length - 1];
  const patokanLiveDraw = draws[draws.length - N];
  const deretLive = deretForMode(computeFormula(spec, draws, draws.length), scanMode);
  const kolom: KolomStat[] = sourceColumns.map((k, i) => ({ kolom: k, hit: hit[i], lemah: hit[i] === 0, digitLive: deretLive[i] }));
  const angkaMati = kolom.filter((k) => k.lemah).map((k) => k.digitLive);
  const angkaKuat = kolom.filter((k) => !k.lemah).map((k) => k.digitLive);

  return { config: { patokanPos: spec.patokanPos, patokanN: N, targetPos, target2D, target3D, L: safeL, scanMode }, jumlahData: draws.length, jumlahBacktest: targets.length, kolom, deretLive, patokanLiveDraw, latestDraw, angkaKuat, angkaMati, rows };
}

export function runFormulaByName(draws: Draw[], formula: string, config: EngineConfig): EngineResult {
  const spec = ALL_FORMULA_SPECS.find((item) => item.formula === formula);
  if (!spec) throw new Error(`Rumus ${formula} tidak ditemukan.`);
  const scanMode = scanModeOrDefault(config.scanMode);
  const target2D = target2DOrDefault(config.target2D);
  const target3D = target3DOrDefault(config.target3D);
  return runFormulaEngine(draws, spec, config.targetPos, config.L, scanMode, target2D, target3D);
}

export function runEngine(draws: Draw[], config: EngineConfig): EngineResult {
  const { patokanPos, patokanN, targetPos, L } = config;
  const scanMode = scanModeOrDefault(config.scanMode);
  const target2D = target2DOrDefault(config.target2D);
  const target3D = target3DOrDefault(config.target3D);
  return runFormulaEngine(draws, { formula: `${patokanPos}${patokanN}`, type: "base", typeOrder: 0, patokanPos, patokanN, compute: (draw) => digitOf(draw, patokanPos) }, targetPos, L, scanMode, target2D, target3D);
}

export function runEngineFromHistory(historyData: string, config: EngineConfig): EngineResult {
  return runEngine(parseHistory(historyData), config);
}

export function runAutoScan(draws: Draw[], config: AutoScanConfig): AutoScanResult {
  const safeConfig = { L: clamp(config.L, 14, 1, 100), targetPos: config.targetPos || "K", target2D: target2DOrDefault(config.target2D), target3D: target3DOrDefault(config.target3D), digitCount: clamp(config.digitCount, DEFAULT_DIGIT_COUNT, 1, 12), stopScan: clamp(config.stopScan, 3, 1, 200), scanMode: scanModeOrDefault(config.scanMode) };
  const isPositionScan = safeConfig.scanMode === "posisi" || safeConfig.scanMode === "off_posisi";
  const targets = isPositionScan ? (config.targetPos ? [config.targetPos] : POSISI) : ["K" as Posisi];
  const items: RankedItem[] = [];
  let totalChecked = 0;

  for (const targetPos of targets) {
    for (const spec of ALL_FORMULA_SPECS) {
      totalChecked += 1;
      try {
        const result = runFormulaEngine(draws, spec, targetPos, safeConfig.L, safeConfig.scanMode, safeConfig.target2D, safeConfig.target3D);
        const profile = compressionProfile(result, safeConfig.digitCount, safeConfig.scanMode);
        if (!profile) continue;

        const columns = profile.displayColumns;
        const angkaHidup = digitsFromColumns(result, columns);
        if (isJumlah2DMode(safeConfig.scanMode) && angkaHidup.includes(0)) continue;

        const columnSet = new Set<Kolom>(columns);
        items.push({
          targetPos,
          target2D: safeConfig.target2D,
          target3D: safeConfig.target3D,
          scanMode: safeConfig.scanMode,
          patokanPos: spec.patokanPos,
          patokanN: spec.patokanN,
          formula: spec.formula,
          code: scanCode(targetPos, spec.formula, safeConfig.L, activeColumnsText(columns, safeConfig.scanMode), safeConfig.scanMode, safeConfig.target2D, safeConfig.target3D),
          angkaHidup,
          kolomHidup: columns,
          angkaMati: result.kolom.filter((k) => !columnSet.has(k.kolom as Kolom)).map((k) => k.digitLive),
          kolomMati: result.kolom.filter((k) => !columnSet.has(k.kolom as Kolom)).map((k) => k.kolom as Kolom),
          activeColumns: activeColumnsText(columns, safeConfig.scanMode),
          jumlahHidup: columns.length,
          coreSize: profile.coreSize,
          coreColumns: profile.coreColumns,
          supportColumns: profile.supportColumns,
          supportReasons: profile.supportReasons,
          consensusDigits: [],
          consensusOverlap: 0,
          consensusWeight: 0,
          result,
          typeOrder: spec.typeOrder,
          strength: profile.coreSize,
          rankCoreSize: profile.coreSize,
          hitScore: profile.hitScore,
          recentScore: profile.recentScore,
        });
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
