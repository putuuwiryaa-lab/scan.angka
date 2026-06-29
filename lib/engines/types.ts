// types.ts
// Tipe bersama untuk engine A/C/K/E (As, Cop, Kepala, Ekor).

/** Posisi digit dalam hasil 4D: A=As(0) C=Cop(1) K=Kepala(2) E=Ekor(3). */
export type Posisi = "A" | "C" | "K" | "E";

/** Satu hasil keluaran 4 digit, mis. "3912". */
export type Draw = string;

/** Label kolom deret, A..J (10 kolom). */
export const KOLOM = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
export type Kolom = (typeof KOLOM)[number];

/** Indeks digit untuk tiap posisi di string 4D. */
export const POS_INDEX: Record<Posisi, number> = { A: 0, C: 1, K: 2, E: 3 };

/** Setelan engine. */
export interface EngineConfig {
  /** Posisi patokan, mis. "A". */
  patokanPos: Posisi;
  /**
   * Indeks mundur patokan (1-9). N=1 = hasil terbaru.
   * Patokan diambil dari hasil N langkah sebelum target.
   */
  patokanN: number;
  /** Posisi target yang diprediksi, mis. "K" (kepala). */
  targetPos: Posisi;
  /** Jumlah baris backtest (jumlah target terbaru yang diuji). */
  L: number;
}

/** Statistik satu kolom deret. */
export interface KolomStat {
  kolom: Kolom;
  /** Berapa kali target asli jatuh di kolom ini selama backtest. */
  hit: number;
  /** True jika kolom tidak pernah kena (lemah/mati). */
  lemah: boolean;
  /** Digit di kolom ini pada deret live (prediksi berikutnya). */
  digitLive: number;
}

/** Satu baris backtest (untuk ditampilkan seperti tabel referensi situs). */
export interface BacktestRow {
  /** Hasil sumber patokan (N langkah sebelum target). */
  patokanDraw: Draw;
  /** Hasil target yang diuji. */
  targetDraw: Draw;
  /** Digit patokan yang dipakai sebagai awal deret. */
  patokan: number;
  /** Deret 10 digit (kolom A..J). */
  deret: number[];
  /** Digit target asli. */
  targetDigit: number;
  /** Kolom tempat target jatuh. */
  kolomKena: Kolom;
}

/** Hasil lengkap engine. */
export interface EngineResult {
  config: EngineConfig;
  /** Jumlah hasil yang dipakai (setelah clamp). */
  jumlahData: number;
  /** Jumlah target backtest yang benar-benar diuji. */
  jumlahBacktest: number;
  /** Statistik per kolom A..J. */
  kolom: KolomStat[];
  /** Deret live: patokan untuk prediksi draw berikutnya. */
  deretLive: number[];
  /** Hasil sumber patokan untuk deret live. */
  patokanLiveDraw: Draw;
  /** Digit kuat (kolom pernah kena) di deret live, urut menarik. */
  angkaKuat: number[];
  /** Digit lemah/mati (kolom tak pernah kena) di deret live. */
  angkaMati: number[];
  /** Detail tiap baris backtest (terbaru di akhir). */
  rows: BacktestRow[];
}
