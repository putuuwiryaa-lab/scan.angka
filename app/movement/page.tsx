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

const OUTPUT_DESCRIPTION: Record<MovementOutputType, string> = {
  position: "Satu posisi wajib masuk",
  ai: "Minimal satu target masuk",
  bbfs: "Semua target wajib masuk",
};

const METHOD_LABEL: Record<MovementMethod, string> = {
  delta: "Delta",
  motif: "Motif",
  cycle: "Cycle",
  cross: "Cross Position",
  joint_pair: "Joint Pair",
};

const POSITION_OPTIONS: MovementSheetOption[] = [
  { value: "A", label: "AS" },
  { value: "C", label: "COP" },
  { value: "K", label: "KPL" },
  { value: "E", label: "EKR" },
];

const GROUP_OPTIONS: MovementSheetOption[] = [
  { value: "2d_depan", label: "2D Depan", secondary: "AS + COP" },
  { value: "2d_tengah", label: "2D Tengah", secondary: "COP + KPL" },
  { value: "2d_belakang", label: "2D Belakang", secondary: "KPL + EKR" },
  { value: "3d_depan", label: "3D Depan", secondary: "AS + COP + KPL" },
  { value: "3d_belakang", label: "3D Belakang", secondary: "COP + KPL + EKR" },
  { value: "4d", label: "4D", secondary: "AS + COP + KPL + EKR" },
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

const OUTPUT_TYPES: MovementOutputType[] = ["position", "ai", "bbfs"];

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
    <button type="button" className={styles.fieldButton} onClick={onClick}>
      <span>
        <small>{label}</small>
        <b>{value}</b>
        {hint && <em>{hint}</em>}
      </span>
      <i aria-hidden="true">›</i>
    </button>
  );
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}%`;
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
    secondary: market.latestResult ? `Result terakhir ${market.latestResult}` : undefined,
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
  }

  function chooseTarget(value: MovementTarget) {
    setTarget(value);
    setDigitCount((current) => Math.max(minimumDigits(outputType, value), current));
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
      `*${result.digits.join("")}*`,
      result.offDigits.length ? `OFF: ${result.offDigits.join("")}` : "",
      "",
      `Metode Unggul: ${METHOD_LABEL[result.selectedMethod]} W${result.selectedWindow}`,
      `Uji Terbaru: ${result.evaluation.l14.hit}/14`,
      `Status: ${result.strength}`,
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
    window.setTimeout(() => setCopied(false), 1600);
  }

  const resolvedMarketName = marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran";
  const errorText = movementError || marketError;

  return (
    <main className={`wrap ${styles.page}`} aria-busy={loading}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <span>PREDIKSI CERDAS</span>
          <small>{syncText}</small>
        </div>
        <h1>Cari pola terkuat.<br />Ambil hasil terbaik.</h1>
        <p>Engine menguji metode dan window secara otomatis. Kamu cukup pilih pasaran dan jenis output.</p>
      </header>

      <section className={styles.setupCard} aria-label="Pengaturan prediksi">
        <FieldButton
          label="Pasaran"
          value={selectedMarket ? marketTitle(selectedMarket) : "Pilih pasaran"}
          hint={selectedMarket?.latestResult ? `Result terakhir ${selectedMarket.latestResult}` : "Wajib dipilih"}
          onClick={() => {
            if (!isOpen("market")) setMarketQuery("");
            toggleDropdown("market");
          }}
        />

        <div className={styles.modeBlock}>
          <span>Mode output</span>
          <div className={styles.modeTabs} role="tablist" aria-label="Mode output">
            {OUTPUT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={outputType === type}
                className={outputType === type ? styles.modeActive : styles.modeButton}
                onClick={() => chooseOutput(type)}
              >
                <b>{OUTPUT_LABEL[type]}</b>
                <small>{OUTPUT_DESCRIPTION[type]}</small>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.choiceGrid}>
          <FieldButton
            label="Target"
            value={TARGET_LABEL[target]}
            onClick={() => toggleDropdown("target")}
          />
          <FieldButton
            label="Jumlah angka"
            value={`${digitCount} digit`}
            onClick={() => toggleDropdown("digit")}
          />
        </div>

        <button className={styles.runButton} type="button" disabled={loading || !marketId} onClick={startAnalysis}>
          {loading ? <><span className={styles.spinner} />Mencari pola terbaik...</> : "Cari Prediksi Terbaik"}
        </button>

        {errorText && <div className={styles.error}>{errorText}</div>}
      </section>

      <div ref={resultRef} tabIndex={-1} className={styles.resultAnchor}>
        {result && (
          <section className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <div>
                <span className={result.released ? styles.statusGood : styles.statusOff}>
                  {result.released ? "HASIL TERPILIH" : "BELUM LAYAK TERBIT"}
                </span>
                <h2>{resolvedMarketName}</h2>
                <p>{OUTPUT_LABEL[result.config.outputType]} {TARGET_LABEL[result.config.target]} · {result.config.digitCount} digit</p>
              </div>
              <div className={styles.scoreBadge}>
                <b>{result.evaluation.l14.hit}<small>/14</small></b>
                <span>Uji terbaru</span>
              </div>
            </div>

            {result.released ? (
              <>
                <div className={styles.numberResult}>{result.digits.join("")}</div>
                <div className={styles.resultMeta}>
                  <div><span>Metode unggul</span><b>{METHOD_LABEL[result.selectedMethod]} · W{result.selectedWindow}</b></div>
                  <div><span>Digit OFF</span><b>{result.offDigits.join("") || "—"}</b></div>
                  <div><span>Kekuatan</span><b>{result.strength}</b></div>
                </div>
                <button className={styles.copyButton} type="button" onClick={copyResult}>
                  {copied ? "✓ Berhasil disalin" : "Salin Angka"}
                </button>
              </>
            ) : (
              <div className={styles.noRelease}>
                <b>Belum ada pola yang cukup kuat.</b>
                <span>Metode terbaik hanya mencatat {result.evaluation.l14.hit}/14. Minimal {result.minimumReleaseHits}/14 diperlukan.</span>
              </div>
            )}

            <details className={styles.details}>
              <summary>
                <span>Lihat detail analisa</span>
                <i aria-hidden="true">⌄</i>
              </summary>

              <div className={styles.detailBody}>
                <div className={styles.quickStats}>
                  <div><b>{result.evaluation.l7.hit}/7</b><span>7 terbaru</span></div>
                  <div><b>{signed(result.evaluation.l14.lift)}</b><span>Di atas baseline</span></div>
                  <div><b>{result.evaluation.l14.longestMissStreak}</b><span>Patah beruntun</span></div>
                  <div><b>{result.confidence}%</b><span>Keyakinan</span></div>
                </div>

                <section className={styles.detailSection}>
                  <header><h3>Peringkat metode</h3><span>{result.config.candidateCount} kandidat diuji</span></header>
                  <div className={styles.rankingList}>
                    {result.tournament.slice(0, 6).map((candidate, index) => (
                      <div key={`${candidate.method}-${candidate.window}`}>
                        <span>{index + 1}</span>
                        <div><b>{METHOD_LABEL[candidate.method]} · W{candidate.window}</b><small>7 terbaru {candidate.l7Hit}/7</small></div>
                        <strong>{candidate.evaluation.hit}/14</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <header><h3>Jejak uji L14</h3><span>Tanpa membaca target lebih dulu</span></header>
                  <div className={styles.auditList}>
                    {result.rows.map((row) => (
                      <div key={`${row.targetIndex}-${row.phase}`}>
                        <span>{row.outputDigits.join("")}</span>
                        <span>{row.targetDraw}</span>
                        <b className={row.covered ? styles.hit : styles.miss}>{row.covered ? "KENA" : "PATAH"}</b>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </details>
          </section>
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
        open={isOpen("target")}
        title="Pilih Target"
        options={targetOptions}
        selectedValue={target}
        onSelect={(value) => chooseTarget(String(value) as MovementTarget)}
        onClose={closeDropdown}
      />
      <MovementSelectSheet
        open={isOpen("digit")}
        title="Pilih Jumlah Angka"
        options={digitOptions}
        selectedValue={digitCount}
        onSelect={(value) => { setDigitCount(Number(value)); closeDropdown(); }}
        onClose={closeDropdown}
      />
    </main>
  );
}
