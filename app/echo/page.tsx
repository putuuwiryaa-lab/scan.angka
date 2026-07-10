"use client";

import { useState } from "react";
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

  const targetText = isPositionMode(scanMode)
    ? LABEL[targetPos]
    : is3DMode(scanMode)
      ? TARGET_3D_LABEL[target3D]
      : TARGET_2D_LABEL[target2D];

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

  const item = result?.items[0] ?? null;
  const resolvedMarketName = marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran";

  return (
    <div className={`wrap ${styles.page}`}>
      <header className="hero">
        <div className="hero-kicker">Adaptive Historical Matching</div>
        <h1>Echo Engine</h1>
        <p>Satu rekomendasi utama dengan discovery, validation, dan final holdout yang dipisahkan.</p>
      </header>
      <div className="sync-status">{syncText}</div>
      <AppPromoBanner />

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

      {result && !item && <div className="panel scan-empty">{result.message || "Echo belum menemukan sinyal yang cukup kuat."}</div>}
      {item && <EchoResultView item={item} marketName={resolvedMarketName} />}
      <BottomNav />
    </div>
  );
}
