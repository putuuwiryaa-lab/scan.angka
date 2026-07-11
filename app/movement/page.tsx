"use client";

import { useEffect, useRef, useState } from "react";
import BottomNav from "../bottom-nav";
import AppPromoBanner from "../shared/AppPromoBanner";
import { useMarketPicker } from "../scan/hooks/useMarketPicker";
import { useScanDropdowns } from "../scan/hooks/useScanDropdowns";
import { marketTitle } from "../shared/scan-utils";
import type { Market } from "../scan/types";
import type {
  MovementGroupTarget,
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
    if (!result) return;
    const resolvedMarket = marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran";
    const text = [
      `*${String(resolvedMarket).toUpperCase()}*`,
      `${OUTPUT_LABEL[result.config.outputType]} ${TARGET_LABEL[result.config.target]} · ${result.config.digitCount} DIGIT`,
      "",
      result.digits.join(""),
      result.offDigits.length ? `OFF: ${result.offDigits.join("")}` : "",
      `Kekuatan: ${result.strength} · Confidence ${result.confidence}%`,
      `L15: ${result.evaluation.l15.hit}/${result.evaluation.l15.total}`,
      `L30: ${result.evaluation.l30.hit}/${result.evaluation.l30.total}`,
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
        <h1>Prediksi berdasarkan pergerakan data</h1>
        <p>Engine membaca transisi, motif gerakan, siklus, dan hubungan antarposisi. Bobot dipilih otomatis melalui walk-forward.</p>
      </header>

      <section className={`panel ${styles.controls}`} aria-label="Pengaturan Movement Engine">
        <div className={styles.controlHead}>
          <div><span>PENGATURAN OUTPUT</span><b>Pilih kebutuhan analisa</b></div>
          <small>4 pilihan</small>
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
          <span>{outputType === "ai" ? "Status kena jika sekurangnya satu digit target masuk." : outputType === "bbfs" ? "Status kena hanya jika seluruh digit target masuk." : "Status kena jika digit posisi berikutnya terdapat dalam output."}</span>
        </div>

        <button className={styles.runButton} type="button" disabled={loading || !marketId} onClick={startAnalysis}>
          {loading ? "Membaca pergerakan data..." : "Jalankan Analisa"}
        </button>
        {(movementError || marketError) && <div className={styles.error}>{movementError || marketError}</div>}
      </section>

      <div ref={resultRef} tabIndex={-1} className={styles.resultAnchor}>
        {result && (
          <div className={styles.resultStack}>
            <section className={`${styles.card} ${styles.primaryCard}`}>
              <div className={styles.primaryHead}>
                <div>
                  <span>REKOMENDASI · {result.strength}</span>
                  <h2>{resolvedMarketName}</h2>
                  <p>{OUTPUT_LABEL[result.config.outputType]} {TARGET_LABEL[result.config.target]} · {result.config.digitCount} digit</p>
                </div>
                <div className={styles.confidence}><b>{result.confidence}%</b><small>Confidence</small></div>
              </div>

              <div className={styles.digits} aria-label="Angka rekomendasi">
                {result.digits.map((digit) => <span key={digit}>{digit}</span>)}
              </div>

              <div className={styles.offLine}><span>OFF</span><b>{result.offDigits.join("") || "—"}</b></div>
              <p className={styles.message}>{result.message}</p>
              <button className={styles.copyButton} type="button" onClick={copyResult}>
                {copied ? "✓ Hasil berhasil disalin" : "Salin Hasil"}
              </button>
            </section>

            <section className={styles.card}>
              <header className={styles.sectionHead}><h3>Evaluasi</h3><p>{result.objective}</p></header>
              <div className={styles.metricGrid}>
                <div><b>{rateText(result.evaluation.l15.hit, result.evaluation.l15.total, result.evaluation.l15.lift)}</b><span>L15 · lift</span></div>
                <div><b>{rateText(result.evaluation.l30.hit, result.evaluation.l30.total, result.evaluation.l30.lift)}</b><span>L30 · lift</span></div>
                <div><b>{rateText(result.evaluation.l60.hit, result.evaluation.l60.total, result.evaluation.l60.lift)}</b><span>L60 · lift</span></div>
                <div><b>{rateText(result.evaluation.holdout.hit, result.evaluation.holdout.total, result.evaluation.holdout.lift)}</b><span>Holdout · lift</span></div>
                <div><b>{result.evaluation.holdout.baseline}%</b><span>Baseline</span></div>
                <div><b>{result.evaluation.holdout.longestMissStreak}</b><span>Miss streak</span></div>
              </div>
            </section>

            <section className={styles.card}>
              <header className={styles.sectionHead}><h3>Cara Engine Membaca Data</h3><p>Profil {result.selectedProfile} dipilih tanpa memakai final holdout.</p></header>
              <div className={styles.metricGrid}>
                <div><b>{result.regime}</b><span>Kondisi gerakan</span></div>
                <div><b>{result.config.sourceDataSize}</b><span>Jumlah result</span></div>
                <div><b>{Math.round(result.weights.transition * 100)}%</b><span>Transisi</span></div>
                <div><b>{Math.round(result.weights.motif * 100)}%</b><span>Motif</span></div>
                <div><b>{Math.round(result.weights.cycle * 100)}%</b><span>Siklus</span></div>
                <div><b>{Math.round(result.weights.cross * 100)}%</b><span>Relasi posisi</span></div>
              </div>
            </section>

            <section className={styles.card}>
              <header className={styles.sectionHead}><h3>Ranking Digit</h3><p>Skor relatif dari distribusi probabilitas live.</p></header>
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
              <header className={styles.sectionHead}><h3>Riwayat Uji Terbaru</h3><p>Prediksi dibentuk hanya dari data yang tersedia sebelum target.</p></header>
              <div className={styles.auditList}>
                {result.rows.slice(-15).map((row) => (
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
