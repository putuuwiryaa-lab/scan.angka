"use client";

import { useEffect, useRef, useState } from "react";
import BottomNav from "../bottom-nav";
import AppPromoBanner from "../shared/AppPromoBanner";
import { useMarketPicker } from "../scan/hooks/useMarketPicker";
import { useScanDropdowns } from "../scan/hooks/useScanDropdowns";
import { marketTitle } from "../shared/scan-utils";
import type { Market } from "../scan/types";
import type {
  MovementMethod,
  MovementOutputType,
  MovementTarget,
} from "../../lib/movement/types";
import MovementSelectSheet, {
  type MovementSheetOption,
} from "./components/MovementSelectSheet";
import styles from "./movement.module.css";
import { useMovementRunner } from "./useMovementRunner";

const OUTPUT_LABEL: Record<MovementOutputType, string> = {
  position: "Posisi",
  ai: "AI",
  bbfs: "BBFS",
};

const METHOD_LABEL: Record<MovementMethod, string> = {
  delta: "Delta",
  motif: "Motif",
  cycle: "Cycle",
  cross: "Cross-position",
  joint_pair: "Joint Pair",
};

const POSITION_OPTIONS: MovementSheetOption[] = [
  { value: "A", label: "AS" },
  { value: "C", label: "COP" },
  { value: "K", label: "KPL" },
  { value: "E", label: "EKR" },
];

const GROUP_OPTIONS: MovementSheetOption[] = [
  { value: "2d_depan", label: "2D Depan", secondary: "AS dan COP" },
  { value: "2d_tengah", label: "2D Tengah", secondary: "COP dan KPL" },
  { value: "2d_belakang", label: "2D Belakang", secondary: "KPL dan EKR" },
  { value: "3d_depan", label: "3D Depan", secondary: "AS, COP, dan KPL" },
  { value: "3d_belakang", label: "3D Belakang", secondary: "COP, KPL, dan EKR" },
  { value: "4d", label: "4D", secondary: "AS, COP, KPL, dan EKR" },
];

const TARGET_LABEL: Record<MovementTarget, string> = {
  A: "AS",
  C: "COP",
  K: "KPL",
  E: "EKR",
  "2d_depan": "2D Depan",
  "2d_tengah": "2D Tengah",
  "2d_belakang": "2D Belakang",
  "3d_depan": "3D Depan",
  "3d_belakang": "3D Belakang",
  "4d": "4D",
};

const OUTPUT_OPTIONS: MovementSheetOption[] = [
  { value: "position", label: "Posisi", secondary: "Satu posisi wajib masuk" },
  { value: "ai", label: "AI", secondary: "Minimal satu digit target masuk" },
  { value: "bbfs", label: "BBFS", secondary: "Semua digit target wajib masuk" },
];

function minimumDigits(outputType: MovementOutputType, target: MovementTarget): number {
  if (outputType !== "bbfs") return 1;
  if (target === "4d") return 4;
  if (target === "3d_depan" || target === "3d_belakang") return 3;
  return 2;
}

function FieldButton({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <button type="button" onClick={onClick}>
        <span><b>{value}</b>{hint && <small>{hint}</small>}</span>
        <i aria-hidden="true">›</i>
      </button>
    </div>
  );
}

function rateText(hit: number, total: number, lift: number): string {
  return `${hit}/${total} · ${lift >= 0 ? "+" : ""}${lift}%`;
}

export default function MovementPage() {
  const {
    marketId,
    marketQuery,
    selectedMarket,
    filteredMarkets,
    syncText,
    marketError,
    setMarketQuery,
    selectMarket,
  } = useMarketPicker();
  const { isOpen, toggleDropdown, closeDropdown } = useScanDropdowns();
  const [outputType, setOutputType] = useState<MovementOutputType>("position");
  const [target, setTarget] = useState<MovementTarget>("K");
  const [digitCount, setDigitCount] = useState(7);
  const [copied, setCopied] = useState(false);
  const { marketName, result, loading, movementError, runMovement } = useMovementRunner();
  const resultRef = useRef<HTMLDivElement>(null);

  const targetOptions = outputType === "position" ? POSITION_OPTIONS : GROUP_OPTIONS;
  const digitOptions: MovementSheetOption[] = Array.from(
    { length: 10 - minimumDigits(outputType, target) },
    (_, index) => minimumDigits(outputType, target) + index,
  ).map((value) => ({ value, label: `${value} digit` }));
  const marketOptions: MovementSheetOption[] = filteredMarkets.map((market) => ({
    value: market.id,
    label: marketTitle(market),
    secondary: market.latestResult ? `Keluaran terakhir: ${market.latestResult}` : undefined,
  }));

  useEffect(() => {
    if (!result) return;
    const timeout = window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      resultRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [result]);

  function chooseMarket(value: string | number) {
    const market = filteredMarkets.find((item) => item.id === String(value));
    if (market) selectMarket(market as Market);
    closeDropdown();
  }

  function chooseOutput(value: MovementOutputType) {
    setOutputType(value);
    if (value === "position") {
      setTarget("K");
      setDigitCount(7);
    } else if (value === "ai") {
      setTarget("2d_belakang");
      setDigitCount(4);
    } else {
      setTarget("4d");
      setDigitCount(8);
    }
    closeDropdown();
  }

  function chooseTarget(value: MovementTarget) {
    setTarget(value);
    const minimum = minimumDigits(outputType, value);
    setDigitCount((current) => Math.max(minimum, current));
    closeDropdown();
  }

  function startAnalysis() {
    runMovement({
      marketId,
      outputType,
      target,
      digitCount,
      onBeforeRun: () => {
        closeDropdown();
        setCopied(false);
      },
    });
  }

  async function copyResult() {
    if (!result?.released) return;
    const resolvedMarket = marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran";
    const text = [
      `*${String(resolvedMarket).toUpperCase()}*`,
      `${OUTPUT_LABEL[result.config.outputType]} ${TARGET_LABEL[result.config.target]} · ${result.config.digitCount} DIGIT`,
      "",
      result.digits.join(""),
      result.offDigits.length ? `OFF: ${result.offDigits.join("")}` : "",
      `Metode: ${METHOD_LABEL[result.selectedMethod]} W${result.selectedWindow}`,
      `Walk-forward: ${result.evaluation.l14.hit}/14`,
      `Kekuatan: ${result.strength} · Confidence ${result.confidence}%`,
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1700);
  }

  const resolvedMarketName = marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran";

  return (
    <main className={`wrap ${styles.page}`} aria-busy={loading}>
      <header className={styles.hero}>
        <div><span>MOVEMENT ENGINE</span><small>{syncText}</small></div>
        <h1>Turnamen metode pada 14 result terbaru</h1>
        <p>Semua metode diuji dengan window training kelipatan 14. Pemenang L14 dilatih ulang pada window terbaru untuk memprediksi result berikutnya.</p>
      </header>

      <section className={`panel ${styles.controls}`} aria-label="Pengaturan Movement Engine">
        <div className={styles.controlHead}>
          <div><span>PENGATURAN OUTPUT</span><b>Pilih kebutuhan analisa</b></div>
          <small>L14 otomatis</small>
        </div>

        <FieldButton
          label="Pasaran"
          value={selectedMarket ? marketTitle(selectedMarket) : "Pilih pasaran"}
          hint={selectedMarket?.latestResult ? `Keluaran terakhir: ${selectedMarket.latestResult}` : "Pasaran wajib dipilih"}
          onClick={() => {
            if (!isOpen("market")) setMarketQuery("");
            toggleDropdown("market");
          }}
        />

        <div className={styles.controlGrid}>
          <FieldButton label="Jenis Output" value={OUTPUT_LABEL[outputType]} onClick={() => toggleDropdown("jenis")} />
          <FieldButton label="Target" value={TARGET_LABEL[target]} onClick={() => toggleDropdown("target")} />
        </div>

        <FieldButton label="Jumlah Digit" value={`${digitCount} digit`} onClick={() => toggleDropdown("digit")} />

        <div className={styles.ruleBox}>
          <b>{outputType === "ai" ? "AI: minimal satu digit" : outputType === "bbfs" ? "BBFS: semua digit target" : "Posisi: satu digit posisi"}</b>
          <span>Metode hanya diterbitkan jika pemenang L14 melampaui batas baseline yang ditetapkan engine.</span>
        </div>

        <button className={styles.runButton} type="button" disabled={loading || !marketId} onClick={startAnalysis}>
          {loading ? "Menguji metode dan window..." : "Jalankan Analisa"}
        </button>
        {(movementError || marketError) && <div className={styles.error}>{movementError || marketError}</div>}
      </section>

      <div ref={resultRef} tabIndex={-1} className={styles.resultAnchor}>
        {result && (
          <div className={styles.resultStack}>
            <section className={`${styles.card} ${styles.primaryCard}`}>
              <div className={styles.primaryHead}>
                <div>
                  <span>{result.released ? `REKOMENDASI · ${result.strength}` : "REKOMENDASI TIDAK DITERBITKAN"}</span>
                  <h2>{resolvedMarketName}</h2>
                  <p>{OUTPUT_LABEL[result.config.outputType]} {TARGET_LABEL[result.config.target]} · {result.config.digitCount} digit</p>
                </div>
                <div className={styles.confidence}><b>{result.confidence}%</b><small>Confidence</small></div>
              </div>

              {result.released ? (
                <>
                  <div className={styles.digits} aria-label="Angka rekomendasi">
                    {result.digits.map((digit) => <span key={digit}>{digit}</span>)}
                  </div>
                  <div className={styles.offLine}><span>OFF</span><b>{result.offDigits.join("") || "—"}</b></div>
                </>
              ) : (
                <div className={styles.noRelease}>Tidak ada metode yang cukup kuat untuk result berikutnya.</div>
              )}

              <p className={styles.message}>{result.message}</p>
              {result.released && (
                <button className={styles.copyButton} type="button" onClick={copyResult}>
                  {copied ? "✓ Hasil berhasil disalin" : "Salin Hasil"}
                </button>
              )}
            </section>

            <section className={styles.card}>
              <header className={styles.sectionHead}><h3>Walk-forward Tetap L14</h3><p>{result.objective}</p></header>
              <div className={styles.metricGrid}>
                <div><b>{rateText(result.evaluation.l14.hit, 14, result.evaluation.l14.lift)}</b><span>L14 · lift</span></div>
                <div><b>{result.evaluation.l7.hit}/7</b><span>7 terbaru</span></div>
                <div><b>{result.evaluation.l3.hit}/3</b><span>3 terbaru</span></div>
                <div><b>{result.evaluation.l14.baseline}%</b><span>Baseline</span></div>
                <div><b>{result.minimumReleaseHits}/14</b><span>Minimal terbit</span></div>
                <div><b>{result.evaluation.l14.longestMissStreak}</b><span>Miss streak</span></div>
              </div>
            </section>

            <section className={styles.card}>
              <header className={styles.sectionHead}><h3>Pemenang Turnamen</h3><p>Dipilih dari seluruh metode dan window yang diuji terhadap 14 result terbaru.</p></header>
              <div className={styles.metricGrid}>
                <div><b>{METHOD_LABEL[result.selectedMethod]}</b><span>Metode terpilih</span></div>
                <div><b>W{result.selectedWindow}</b><span>Window training</span></div>
                <div><b>{result.config.candidateCount}</b><span>Total kandidat</span></div>
                <div><b>{result.config.windows.length}</b><span>Jumlah window</span></div>
                <div><b>{result.config.sourceDataSize}</b><span>Jumlah result</span></div>
                <div><b>{result.regime}</b><span>Kondisi gerakan</span></div>
              </div>
            </section>

            <section className={styles.card}>
              <header className={styles.sectionHead}><h3>Ranking Metode × Window</h3><p>Urutan: win L14, L7, miss streak, L3, stabilitas window tetangga.</p></header>
              <div className={styles.tournamentList}>
                {result.tournament.map((candidate, index) => (
                  <div key={`${candidate.method}-${candidate.window}`}>
                    <span>{index + 1}</span>
                    <div><b>{METHOD_LABEL[candidate.method]} · W{candidate.window}</b><small>Stabilitas tetangga {candidate.neighborAverageHit}/14</small></div>
                    <strong>{candidate.evaluation.hit}/14</strong>
                    <small>L7 {candidate.l7Hit}/7</small>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <header className={styles.sectionHead}><h3>Ranking Digit Live</h3><p>Dibentuk ulang memakai {METHOD_LABEL[result.selectedMethod]} dan {result.selectedWindow} data terbaru.</p></header>
              <div className={styles.probabilityList}>
                {result.probabilities.map((item) => (
                  <div key={item.digit}>
                    <b>{item.digit}</b>
                    <span><i style={{ width: `${Math.min(100, item.score * 5)}%` }} /></span>
                    <small>{item.score}%</small>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <header className={styles.sectionHead}><h3>Riwayat Uji L14</h3><p>Pada setiap baris, target tidak pernah ikut masuk ke data training.</p></header>
              <div className={styles.auditList}>
                {result.rows.map((row) => (
                  <div key={`${row.targetIndex}-${row.phase}`}>
                    <span>{row.outputDigits.join("")}</span>
                    <span>→ {row.targetDraw}</span>
                    <b className={row.covered ? styles.hit : styles.miss}>{row.covered ? "KENA" : "PATAH"}</b>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <div className={styles.toolsWrap}><AppPromoBanner /></div>
      <BottomNav />

      <MovementSelectSheet
        open={isOpen("market")}
        title="Pilih Pasaran"
        options={marketOptions}
        selectedValue={marketId}
        searchValue={marketQuery}
        searchPlaceholder="Cari pasaran..."
        onSearchChange={setMarketQuery}
        onSelect={chooseMarket}
        onClose={closeDropdown}
        emptyText="Pasaran tidak ditemukan"
      />
      <MovementSelectSheet
        open={isOpen("jenis")}
        title="Pilih Jenis Output"
        options={OUTPUT_OPTIONS}
        selectedValue={outputType}
        onSelect={(value) => chooseOutput(String(value) as MovementOutputType)}
        onClose={closeDropdown}
      />
      <MovementSelectSheet
        open={isOpen("target")}
        title="Pilih Target"
        options={targetOptions}
        selectedValue={target}
        onSelect={(value) => chooseTarget(String(value) as MovementTarget)}
        onClose={closeDropdown}
      />
      <MovementSelectSheet
        open={isOpen("digit")}
        title="Pilih Jumlah Digit"
        options={digitOptions}
        selectedValue={digitCount}
        onSelect={(value) => { setDigitCount(Number(value)); closeDropdown(); }}
        onClose={closeDropdown}
      />
    </main>
  );
}
