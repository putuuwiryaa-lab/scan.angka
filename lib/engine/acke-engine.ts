import { KOLOM, POS_INDEX, type AutoScanConfig, type AutoScanItem, type AutoScanResult, type BacktestRow, type Draw, type EngineConfig, type EngineResult, type Kolom, type KolomStat, type Posisi } from "./types";

const POSISI: Posisi[] = ["A", "C", "K", "E"];

export function parseHistory(historyData: string): Draw[] {
  return historyData.trim().split(/\s+/).filter((tok) => /^\d{4}$/.test(tok));
}

function digitOf(draw: Draw, pos: Posisi): number {
  return Number(draw[POS_INDEX[pos]]);
}

function buildDeret(start: number): number[] {
  return Array.from({ length: 10 }, (_, i) => (start + i) % 10);
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function scanCode(target: Posisi, formula: string, L: number, columns: string): string {
  return `#${target.toLowerCase()}_${formula}_L${L}-P0-D0_${columns || "-"}`;
}

export function runEngine(draws: Draw[], config: EngineConfig): EngineResult {
  const { patokanPos, patokanN: N, targetPos, L } = config;
  if (!POSISI.includes(patokanPos) || !POSISI.includes(targetPos)) throw new Error("Posisi tidak valid.");
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
    const patokan = digitOf(draws[sourceIndex], patokanPos);
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
  const deretLive = buildDeret(digitOf(patokanLiveDraw, patokanPos));
  const kolom: KolomStat[] = KOLOM.map((k, i) => ({ kolom: k, hit: hit[i], lemah: hit[i] === 0, digitLive: deretLive[i] }));
  const angkaMati = kolom.filter((k) => k.lemah).map((k) => k.digitLive);
  const angkaKuat = kolom.filter((k) => !k.lemah).map((k) => k.digitLive);

  return { config: { ...config, L: safeL }, jumlahData: draws.length, jumlahBacktest: targets.length, kolom, deretLive, patokanLiveDraw, latestDraw, angkaKuat, angkaMati, rows };
}

export function runEngineFromHistory(historyData: string, config: EngineConfig): EngineResult {
  return runEngine(parseHistory(historyData), config);
}

export function runAutoScan(draws: Draw[], config: AutoScanConfig): AutoScanResult {
  const safeConfig = {
    L: clamp(config.L, 15, 1, 100),
    targetPos: config.targetPos || "K",
    digitCount: clamp(config.digitCount, 3, 1, 10),
    stopScan: clamp(config.stopScan, 3, 1, 200),
  };
  const targets = config.targetPos ? [config.targetPos] : POSISI;
  const items: AutoScanItem[] = [];
  let totalChecked = 0;

  for (const targetPos of targets) {
    for (const patokanPos of POSISI) {
      for (let patokanN = 1; patokanN <= 9; patokanN += 1) {
        totalChecked += 1;
        const formula = `${patokanPos}${patokanN}`;
        const result = runEngine(draws, { patokanPos, patokanN, targetPos, L: safeConfig.L });
        const kolomHidup = result.kolom.filter((k) => !k.lemah).map((k) => k.kolom as Kolom);
        if (result.angkaKuat.length === safeConfig.digitCount) {
          items.push({
            targetPos,
            patokanPos,
            patokanN,
            formula,
            code: scanCode(targetPos, formula, safeConfig.L, kolomHidup.join("")),
            angkaHidup: result.angkaKuat,
            kolomHidup,
            angkaMati: result.angkaMati,
            kolomMati: result.kolom.filter((k) => k.lemah).map((k) => k.kolom as Kolom),
            activeColumns: kolomHidup.join(""),
            jumlahHidup: result.angkaKuat.length,
            result,
          });
          if (items.length >= safeConfig.stopScan) return { config: safeConfig, totalChecked, totalMatched: items.length, items };
        }
      }
    }
  }
  return { config: safeConfig, totalChecked, totalMatched: items.length, items };
}

export function runAutoScanFromHistory(historyData: string, config: AutoScanConfig): AutoScanResult {
  return runAutoScan(parseHistory(historyData), config);
}
