// acke-engine.ts
// Engine inti A/C/K/E. Pure function, tanpa I/O. Mudah dites & dipakai ulang.
//
// Logika (terverifikasi dari tool angkanet):
//  - Token [Posisi][N], mis. A5 = As hasil N langkah sebelum target (N=1 = terbaru).
//  - Deret per baris: kolom A = patokan, B = patokan+1, ... J = patokan+9 (mod 10).
//  - Backtest L target terbaru: tandai kolom tempat digit target asli jatuh.
//  - Kolom tak pernah kena = lemah/mati; sisanya kuat.
//  - Deret live (prediksi berikutnya): patokan dari hasil (terbaru+1-N).
//    Kolom lemah dipetakan ke deret live -> angka mati hari ini.

import {
  type Draw,
  type EngineConfig,
  type EngineResult,
  type BacktestRow,
  type KolomStat,
  KOLOM,
  POS_INDEX,
} from "./types";

/**
 * Parse string history_data dari Supabase menjadi array Draw urut LAMA -> BARU.
 * Format: angka 4D dipisah whitespace. Kiri = terlama, kanan = terbaru.
 * Entri yang bukan 4 digit dibuang.
 */
export function parseHistory(historyData: string): Draw[] {
  return historyData
    .trim()
    .split(/\s+/)
    .filter((tok) => /^\d{4}$/.test(tok));
}

/** Ambil digit pada posisi tertentu dari sebuah Draw. */
function digitOf(draw: Draw, pos: keyof typeof POS_INDEX): number {
  return Number(draw[POS_INDEX[pos]]);
}

/** Bangun deret 10 digit mulai dari `patokan`: [patokan, patokan+1, ... +9] mod 10. */
function buildDeret(patokan: number): number[] {
  return Array.from({ length: 10 }, (_, i) => (patokan + i) % 10);
}

/**
 * Jalankan engine A/C/K/E.
 *
 * @param draws Array hasil urut LAMA -> BARU (pakai parseHistory).
 * @param config Setelan patokan/target/L.
 */
export function runEngine(draws: Draw[], config: EngineConfig): EngineResult {
  const { patokanPos, patokanN: N, targetPos, L } = config;

  if (N < 1 || N > 9) {
    throw new Error(`patokanN harus 1-9, diterima ${N}`);
  }
  if (draws.length <= N) {
    throw new Error(
      `Data tidak cukup: butuh > ${N} hasil, hanya ada ${draws.length}.`
    );
  }

  const len = draws.length;

  // Target valid = indeks yang punya patokan di (t - N) >= 0, yaitu t = N .. len-1.
  const semuaTargetValid: number[] = [];
  for (let t = N; t < len; t++) semuaTargetValid.push(t);

  // Ambil L target terbaru (clamp ke jumlah yang tersedia).
  const targets = semuaTargetValid.slice(-Math.max(0, L));

  // Hitung hit per kolom + kumpulkan baris backtest.
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

  // Deret live: patokan untuk draw berikutnya = hasil (futureTarget - N) = draws[len - N].
  const patokanLiveDraw = draws[len - N];
  const patokanLive = digitOf(patokanLiveDraw, patokanPos);
  const deretLive = buildDeret(patokanLive);

  // Statistik kolom + angka kuat/mati dari deret live.
  const kolom: KolomStat[] = KOLOM.map((k, i) => ({
    kolom: k,
    hit: hit[i],
    lemah: hit[i] === 0,
    digitLive: deretLive[i],
  }));

  const angkaMati = kolom.filter((k) => k.lemah).map((k) => k.digitLive);
  const angkaKuat = kolom.filter((k) => !k.lemah).map((k) => k.digitLive);

  return {
    config,
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

/** Helper ringkas: parse history lalu jalankan engine sekaligus. */
export function runEngineFromHistory(
  historyData: string,
  config: EngineConfig
): EngineResult {
  return runEngine(parseHistory(historyData), config);
}
