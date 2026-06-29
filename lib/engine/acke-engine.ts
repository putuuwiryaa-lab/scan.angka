import {
  type Draw,
  type EngineConfig,
  type EngineResult,
  type BacktestRow,
  type KolomStat,
  KOLOM,
  POS_INDEX,
} from "./types";

export function parseHistory(historyData: string): Draw[] {
  return historyData
    .trim()
    .split(/\s+/)
    .filter((tok) => /^\d{4}$/.test(tok));
}

function digitOf(draw: Draw, pos: keyof typeof POS_INDEX): number {
  return Number(draw[POS_INDEX[pos]]);
}

function buildDeret(patokan: number): number[] {
  return Array.from({ length: 10 }, (_, i) => (patokan + i) % 10);
}

export function runEngine(draws: Draw[], config: EngineConfig): EngineResult {
  const { patokanPos, patokanN: N, targetPos, L } = config;

  if (N < 1 || N > 9) {
    throw new Error(`patokanN harus 1-9, diterima ${N}`);
  }
  if (draws.length <= N) {
    throw new Error(`Data tidak cukup: butuh > ${N} hasil, hanya ada ${draws.length}.`);
  }

  const len = draws.length;
  const semuaTargetValid: number[] = [];
  for (let t = N; t < len; t++) semuaTargetValid.push(t);

  const safeL = Math.max(1, Math.min(100, Number.isFinite(L) ? Math.trunc(L) : 15));
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
