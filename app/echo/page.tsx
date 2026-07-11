"use client";

import { useEffect, useRef, useState } from "react";
import BottomNav from "../bottom-nav";
import AppPromoBanner from "../shared/AppPromoBanner";
import { LABEL, TARGET_2D_LABEL, TARGET_3D_LABEL } from "../scan/constants";
import { useMarketPicker } from "../scan/hooks/useMarketPicker";
import { useScanDropdowns } from "../scan/hooks/useScanDropdowns";
import { is3DMode, isPositionMode, isShioMode } from "../shared/scan-utils";
import type { Market, Posisi, ScanMode, Target2D, Target3D } from "../scan/types";
import EchoControlPanel from "./EchoControlPanel";
import EchoResultView from "./components/EchoResultView";
import styles from "./echo.module.css";
import { useEchoRunner } from "./useEchoRunner";

export default function EchoPage() {
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
  const [scanMode, setScanMode] = useState<ScanMode>("ai_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [target3D, setTarget3D] = useState<Target3D>("belakang");
  const [digitCount, setDigitCount] = useState(4);
  const { marketName, result, loading, echoError, runEcho } = useEchoRunner();
  const resultRef = useRef<HTMLDivElement>(null);

  const targetText = isPositionMode(scanMode)
    ? LABEL[targetPos]
    : is3DMode(scanMode)
      ? TARGET_3D_LABEL[target3D]
      : TARGET_2D_LABEL[target2D];

  const item = result?.items[0] ?? null;
  const resolvedMarketName = marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran";
  const failedFinalVerification = result?.message.includes("verifikasi akhir") ?? false;

  useEffect(() => {
    if (!result) return;
    const timeout = window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      resultRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [result]);

  function chooseMarket(market: Market) {
    selectMarket(market);
    closeDropdown();
  }

  function chooseMode(value: ScanMode) {
    setScanMode(value);
    closeDropdown();
    if (!isShioMode(value) && digitCount > 9) setDigitCount(9);
    if ((value === "ai_3d" || value === "bbfs_3d") && digitCount < 7) setDigitCount(7);
    if (value === "off_3d" && digitCount > 3) setDigitCount(3);
  }

  function startEcho() {
    runEcho({
      marketId,
      scanMode,
      targetPos,
      target2D,
      target3D,
      digitCount,
      onDigitCountChange: setDigitCount,
      onBeforeRun: closeDropdown,
    });
  }

  return (
    <main className={`wrap ${styles.page}`} aria-busy={loading}>
      <header className={styles.mobileHero}>
        <div className={styles.heroTopline}>
          <span className={styles.heroBadge}>ECHO ENGINE</span>
          <span className={styles.syncPill}>{syncText}</span>
        </div>
        <h1>Rekomendasi berdasarkan pola historis</h1>
        <p>Echo menilai pola yang paling relevan, menguji konsistensinya, lalu menampilkan satu rekomendasi terbaik.</p>
      </header>

      <EchoControlPanel
        selectedMarket={selectedMarket}
        filteredMarkets={filteredMarkets}
        marketId={marketId}
        marketQuery={marketQuery}
        marketOpen={isOpen("market")}
        jenisOpen={isOpen("jenis")}
        targetOpen={isOpen("target")}
        digitOpen={isOpen("digit")}
        scanMode={scanMode}
        targetPos={targetPos}
        target2D={target2D}
        target3D={target3D}
        targetText={targetText}
        digitCount={digitCount}
        loading={loading}
        error={echoError || marketError}
        onOpenMarket={() => {
          if (!isOpen("market")) setMarketQuery("");
          toggleDropdown("market");
        }}
        onCloseMarket={closeDropdown}
        onMarketQueryChange={setMarketQuery}
        onSelectMarket={chooseMarket}
        onSelectJenis={chooseMode}
        onToggleJenis={() => toggleDropdown("jenis")}
        onToggleTarget={() => toggleDropdown("target")}
        onSelectTargetPos={(value) => { setTargetPos(value); closeDropdown(); }}
        onSelectTarget2D={(value) => { setTarget2D(value); closeDropdown(); }}
        onSelectTarget3D={(value) => { setTarget3D(value); closeDropdown(); }}
        onToggleDigit={() => toggleDropdown("digit")}
        onSelectDigit={(value) => { setDigitCount(value); closeDropdown(); }}
        onRun={startEcho}
      />

      <div ref={resultRef} tabIndex={-1} className={styles.resultAnchor}>
        {result && !item && (
          <section className={styles.emptyState} role="status">
            <span aria-hidden="true">—</span>
            <div>
              <b>{failedFinalVerification ? "Belum lolos verifikasi akhir" : "Belum ada rekomendasi yang memenuhi standar"}</b>
              <p>{result.message}</p>
              {result.diagnostics?.map((diagnostic) => (
                <p key={diagnostic.code}>
                  <strong>{diagnostic.label}:</strong> {diagnostic.detail}
                </p>
              ))}
            </div>
          </section>
        )}
        {item && <EchoResultView item={item} marketName={resolvedMarketName} />}
      </div>

      <div className={styles.toolsWrap}>
        <AppPromoBanner />
      </div>
      <BottomNav />
    </main>
  );
}
