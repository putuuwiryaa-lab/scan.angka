import {
  type AutoScanConfig,
  type AutoScanItem,
  type AutoScanResult,
  type BacktestRow,
  type Draw,
  type EngineConfig,
  type EngineResult,
  type Kolom,
  type KolomStat,
  type Posisi,
  KOLOM,
  POS_INDEX,
} from "./types";

const POSISI: Posisi[] = ["A", "C", "K", "E"];

export function parseHistory(historyData: string): Draw[] {
  return historyData
    .trim()
    .split(/\s+/)
    .filter((tok) => /^\d{4}$/.test(tok));
}

function digitOf(draw: Draw, pos: Posisi): number {
  return Number(draw[POS_INDEX[pos]]);
}

function buildDeret(patokan: number): number[] {
  return Array.from({ length: 10 }, (_, i) => (patokan + i) % 10);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function targetCode(pos: Posisi): string {
  return pos.toLowerCase();
}

function buildScanCode(target: Posisi, formula: string, L: number, activeColumns: string): string {
  return `#${targetCode(target)}_${formula}_L${L}-P0-D0_${activeColumns || "-"}`;
}

export function runEngine(draws: Draw[], config: EngineConfig): EngineResult {
  const { patokanPos, patokanN: N, targetPos, L } = config;

  if (!POSISI.includes(patokanPos) || !POSISI.includes(targetPos)) {
    throw new Error("Posisi tidak valid.");
  }
  if (N < 1 || N > 9) {
    throw new Error(`patokanN harus 1-9, diterima ${N}`);
  }
  if (draws.length <= N) {
    throw new Error(`Data tidak cukup: butuh > ${N} hasil, hanya ada ${draws.length}.`);
  }

  const len = draws.length;
  const semuaTargetValid: number[] = [];
  for (let t = N; t < len; t++) semuaTargetValid.push(t);

  const safeL = clampNumber(L, 15, 1, 100);
  const targets = semuaTargetValid.slice(-safeL);
  const hit = new Array(10).fill(0);
  const rows: BacktestRow[] = [];

  for (const t of targets) {
    const patokan = digitOf(draws[t - N], patokanPos);
    const deret = buildDeret(patokan);
    const targetDigit = digitOf(draws[t], targetPos);
    const col = (targetDigit - patokan + 10) % 10;
    hit[col]++;
    rows.push({
      patokanDraw: draws[t - N],
      targetDraw: draws[t],
      patokan,
      deret,
      targetDigit,
      kolomKena: KOLOM[col],
    });
  }

  const patokanLiveDraw = draws[len - N];
  const patokanLive = digitOf(patokanLiveDraw, patokanPos);
  const deretLive = buildDeret(patokanLive);

  const kolom: KolomStat[] = KOLOM.map((k, i) => ({
    kolom: k,
    hit: hit[i],
    lemah: hit[i] === 0,
    digitLive: deretLive[i],
  }));

  const angkaMati = kolom.filter((k) => k.lemah).map((k) => k.digitLive);
  const angkaKuat = kolom.filter((k) => !k.lemah).map((k) => k.digitLive);

  return {
    config: { ...config, L: safeL },
    jumlahData: len,
    jumlahBacktest: targets.length,
    kolom,
    deretLive,
    patokanLiveDraw,
    angkaKuat,
    angkaMati,
    rows,
  };
}

export function runEngineFromHistory(historyData: string, config: EngineConfig): EngineResult {
  return runEngine(parseHistory(historyData), config);
}

export function runAutoScan(draws: Draw[], config: AutoScanConfig): AutoScanResult {
  const safeConfig: Required<AutoScanConfig> = {
    L: clampNumber(config.L, 15, 1, 100),
    targetPos: config.targetPos || "K",
    minMati: clampNumber(config.minMati, 1, 1, 10),
    stopScan: clampNumber(config.stopScan, 50, 1, 200),
  };

  const targets = config.targetPos ? [config.targetPos] : POSISI;
  const items: AutoScanItem[] = [];
  let totalChecked = 0;

  for (const targetPos of targets) {
    for (const patokanPos of POSISI) {
      for (let patokanN = 1; patokanN <= 9; patokanN += 1) {
        totalChecked += 1;
        const formula = `${patokanPos}${patokanN}`;
        const result = runEngine(draws, {
          patokanPos,
          patokanN,
          targetPos,
          L: safeConfig.L,
        });
        const kolomMati = result.kolom.filter((k) => k.lemah).map((k) => k.kolom as Kolom);
        const activeColumns = result.kolom.filter((k) => !k.lemah).map((k) => k.kolom).join("");

        if (result.angkaMati.length >= safeConfig.minMati) {
          items.push({
            targetPos,
            patokanPos,
            patokanN,
            formula,
            code: buildScanCode(targetPos, formula, safeConfig.L, activeColumns),
            angkaMati: result.angkaMati,
            kolomMati,
            angkaKuat: result.angkaKuat,
            activeColumns,
            jumlahMati: result.angkaMati.length,
            result,
          });
        }
      }
    }
  }

  const sorted = items
    .sort((a, b) => b.jumlahMati - a.jumlahMati || a.formula.localeCompare(b.formula))
    .slice(0, safeConfig.stopScan);

  return {
    config: safeConfig,
    totalChecked,
    totalMatched: items.length,
    items: sorted,
  };
}

export function runAutoScanFromHistory(historyData: string, config: AutoScanConfig): AutoScanResult {
  return runAutoScan(parseHistory(historyData), config);
}
