"use client";

import { useEffect, useRef, useState } from "react";
import BottomNav from "../bottom-nav";
import AppPromoBanner from "../shared/AppPromoBanner";
import { useMarketPicker } from "../scan/hooks/useMarketPicker";
import { useScanDropdowns } from "../scan/hooks/useScanDropdowns";
import { marketTitle } from "../shared/scan-utils";
import type { Market } from "../scan/types";
import {
  MOVEMENT_METHOD_LABELS,
  type MovementOutputType,
  type MovementResult,
  type MovementTarget,
  type MovementTournamentCandidate,
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
  position: "Fokus satu posisi",
  ai: "Minimal satu target masuk",
  bbfs: "Seluruh target tercakup",
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

function sameCandidate(
  left: Pick<MovementTournamentCandidate, "method" | "window">,
  right: Pick<MovementTournamentCandidate, "method" | "window">,
): boolean {
  return left.method === right.method && left.window === right.window;
}

function candidateEvaluations(result: MovementResult, candidate: MovementTournamentCandidate) {
  return [
    candidate.evaluation,
    ...result.tieBreakRounds.flatMap((round) => {
      const match = round.candidates.find((item) => sameCandidate(item, candidate));
      return match ? [match.evaluation] : [];
    }),
  ];
}

function candidateValidationTrail(result: MovementResult, candidate: MovementTournamentCandidate): string {
  return candidateEvaluations(result, candidate)
    .map((evaluation) => `L${evaluation.total} ${evaluation.hit}/${evaluation.total}`)
    .join(" → ");
}

function latestCandidateEvaluation(result: MovementResult, candidate: MovementTournamentCandidate) {
  const evaluations = candidateEvaluations(result, candidate);
  return evaluations[evaluations.length - 1];
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
    secondary: market.latestResult ? `Result terbaru ${market.latestResult}` : undefined,
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
    if (!result) return;
    const resolvedMarket = marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran";
    const text = [
      `*${String(resolvedMarket).toUpperCase()}*`,
      `${OUTPUT_LABEL[result.config.outputType]} ${TARGET_LABEL[result.config.target]} · ${result.config.digitCount} DIGIT`,
      "",
      `*${result.digits.join("")}*`,
      result.offDigits.length ? `OFF: ${result.offDigits.join("")}` : "",
      "",
      `Model Terpilih: ${MOVEMENT_METHOD_LABELS[result.selectedMethod]} W${result.selectedWindow}`,
      `Validasi Awal L14: ${result.evaluation.l14.hit}/14`,
      result.selectionValidation.total > 14
        ? `Pemecah Seri L${result.selectionValidation.total}: ${result.selectionValidation.hit}/${result.selectionValidation.total}`
        : "",
      result.tieBreakStatus === "history_limit" ? "Status Seri: berhenti pada batas riwayat" : "",
      `Kualitas Sinyal: ${result.strength}`,
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
          <span>ANALISIS ADAPTIF</span>
          <small>{syncText}</small>
        </div>
        <h1>Pola dibaca.<br />Model diuji. Hasil diseleksi.</h1>
        <p>Beragam model membaca transisi, momentum, siklus, pasangan, dan perubahan regime untuk menemukan konfigurasi yang paling konsisten.</p>
      </header>

      <section className={styles.setupCard} aria-label="Konfigurasi analisis adaptif">
        <FieldButton
          label="Pasaran Analisis"
          value={selectedMarket ? marketTitle(selectedMarket) : "Pilih pasaran"}
          hint={selectedMarket?.latestResult ? `Result terbaru ${selectedMarket.latestResult}` : "Pasaran wajib dipilih"}
          onClick={() => {
            if (!isOpen("market")) setMarketQuery("");
            toggleDropdown("market");
          }}
        />

        <div className={styles.modeBlock}>
          <span>Mode Prediksi</span>
          <div className={styles.modeTabs} role="tablist" aria-label="Mode prediksi">
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
            label="Target Analisis"
            value={TARGET_LABEL[target]}
            onClick={() => toggleDropdown("target")}
          />
          <FieldButton
            label="Cakupan Digit"
            value={`${digitCount} digit`}
            onClick={() => toggleDropdown("digit")}
          />
        </div>

        <button className={styles.runButton} type="button" disabled={loading || !marketId} onClick={startAnalysis}>
          {loading ? <><span className={styles.spinner} />Mengevaluasi model...</> : "Jalankan Analisis Adaptif"}
        </button>

        {errorText && <div className={styles.error}>{errorText}</div>}
      </section>

      <div ref={resultRef} tabIndex={-1} className={styles.resultAnchor}>
        {result && (
          <section className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <div>
                <span className={styles.statusGood}>HASIL ADAPTIF</span>
                <h2>{resolvedMarketName}</h2>
                <p>{OUTPUT_LABEL[result.config.outputType]} {TARGET_LABEL[result.config.target]} · cakupan {result.config.digitCount} digit</p>
              </div>
              <div className={styles.scoreBadge}>
                <b>{result.selectionValidation.hit}<small>/{result.selectionValidation.total}</small></b>
                <span>{result.selectionValidation.total > 14 ? `Pemecah Seri L${result.selectionValidation.total}` : "Validasi L14"}</span>
              </div>
            </div>

            <div className={styles.numberResult}>{result.digits.join("")}</div>
            <div className={styles.resultMeta}>
              <div><span>Model Terpilih</span><b>{MOVEMENT_METHOD_LABELS[result.selectedMethod]} · W{result.selectedWindow}</b></div>
              <div><span>Digit Eliminasi</span><b>{result.offDigits.join("") || "—"}</b></div>
              <div><span>Kualitas Sinyal</span><b>{result.strength}</b></div>
            </div>
            <button className={styles.copyButton} type="button" onClick={copyResult}>
              {copied ? "✓ Hasil disalin" : "Salin Hasil"}
            </button>

            <details className={styles.details}>
              <summary>
                <span>Lihat Evaluasi Model</span>
                <i aria-hidden="true">⌄</i>
              </summary>

              <div className={styles.detailBody}>
                <div className={styles.quickStats}>
                  <div><b>{result.evaluation.l14.hit}/14</b><span>Validasi Awal L14</span></div>
                  {result.selectionValidation.total > 14
                    ? <div><b>{result.selectionValidation.hit}/{result.selectionValidation.total}</b><span>Pemecah Seri L{result.selectionValidation.total}</span></div>
                    : <div><b>{result.evaluation.l7.hit}/7</b><span>Validasi L7</span></div>}
                  <div><b>{result.evaluation.l14.longestMissStreak}</b><span>Streak Miss</span></div>
                  <div><b>{result.confidence}%</b><span>Confidence Score</span></div>
                </div>

                <section className={styles.detailSection}>
                  <header><h3>Peringkat Model</h3><span>{result.config.candidateCount} konfigurasi dievaluasi</span></header>
                  <div className={styles.rankingList}>
                    {result.tournament.slice(0, 6).map((candidate, index) => {
                      const latestEvaluation = latestCandidateEvaluation(result, candidate);
                      return (
                        <div key={`${candidate.method}-${candidate.window}`}>
                          <span>{index + 1}</span>
                          <div>
                            <b>{MOVEMENT_METHOD_LABELS[candidate.method]} · W{candidate.window}</b>
                            <small>{candidateValidationTrail(result, candidate)}</small>
                          </div>
                          <strong>{latestEvaluation.hit}/{latestEvaluation.total}</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {result.tieBreakInitialCandidateCount > 1 && (
                  <section className={styles.detailSection}>
                    <header>
                      <h3>Pemecah Seri Walk-Forward</h3>
                      <span>{result.tieBreakStatus === "resolved" ? "Seri berhasil dipecahkan" : "Berhenti pada batas riwayat"}</span>
                    </header>
                    <div className={styles.rankingList}>
                      {result.tieBreakRounds.length > 0 ? result.tieBreakRounds.map((round, index) => (
                        <div key={round.size}>
                          <span>{index + 1}</span>
                          <div>
                            <b>Walk-Forward L{round.size}</b>
                            <small>{round.candidateCount} kandidat diuji · {round.remainingCandidateCount} kandidat masih tertinggi</small>
                          </div>
                          <strong>{round.bestHit}/{round.size}</strong>
                        </div>
                      )) : (
                        <div>
                          <span>!</span>
                          <div>
                            <b>Seri L14 belum dapat diperpanjang</b>
                            <small>Window kandidat membutuhkan riwayat training yang lebih panjang.</small>
                          </div>
                          <strong>—</strong>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <section className={styles.detailSection}>
                  <header>
                    <h3>Audit Walk-Forward L{result.selectionValidation.total}</h3>
                    <span>{result.rows.length} target · target tidak pernah masuk ke data training</span>
                  </header>
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
        title="Pilih Pasaran Analisis"
        options={marketOptions}
        selectedValue={marketId}
        searchValue={marketQuery}
        searchPlaceholder="Cari pasaran..."
        onSearchChange={setMarketQuery}
        onSelect={chooseMarket}
        onClose={closeDropdown}
        emptyText="Pasaran tidak tersedia"
      />
      <MovementSelectSheet
        open={isOpen("target")}
        title="Pilih Target Analisis"
        options={targetOptions}
        selectedValue={target}
        onSelect={(value) => chooseTarget(String(value) as MovementTarget)}
        onClose={closeDropdown}
      />
      <MovementSelectSheet
        open={isOpen("digit")}
        title="Pilih Cakupan Digit"
        options={digitOptions}
        selectedValue={digitCount}
        onSelect={(value) => { setDigitCount(Number(value)); closeDropdown(); }}
        onClose={closeDropdown}
      />
    </main>
  );
}
