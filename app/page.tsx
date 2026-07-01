"use client";

import { useState } from "react";
import BottomNav from "./bottom-nav";
import ScanControlPanel from "./scan/components/ScanControlPanel";
import ScanResultPanel from "./scan/components/ScanResultPanel";
import SavedTreksSection from "./scan/components/SavedTreksSection";
import TrekDetailSheet from "./scan/components/TrekDetailSheet";
import SavedTrekSheet from "./scan/components/SavedTrekSheet";
import { LABEL, TARGET_2D_LABEL } from "./scan/constants";
import { useMarketPicker } from "./scan/hooks/useMarketPicker";
import { useSavedTreks } from "./scan/hooks/useSavedTreks";
import { useScanDropdowns } from "./scan/hooks/useScanDropdowns";
import { useScanRunner } from "./scan/hooks/useScanRunner";
import { useTrekActions } from "./scan/hooks/useTrekActions";
import { isPositionMode, isShioMode } from "./shared/scan-utils";
import type { Market, Posisi, ScanMode, Target2D } from "./scan/types";

export default function Page() {
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

  const [rounds, setRounds] = useState("14");
  const [scanMode, setScanMode] = useState<ScanMode>("ai_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [digitCount, setDigitCount] = useState(4);
  const [stopScan, setStopScan] = useState("1");

  const { marketName, result, loading, scanError, setScanError, runScan } = useScanRunner();
  const {
    savedTreks,
    savedGroups,
    savedLiveMap,
    savedFlashId,
    setSavedFlashId,
    persistSavedTreks,
    deleteSavedTrek: removeSavedTrek,
  } = useSavedTreks();
  const {
    viewItem,
    viewSaved,
    copied,
    viewRows,
    nextPredictionLabels,
    setViewItem,
    setViewSaved,
    resetTrekView,
    openScanItem,
    saveTrek,
    deleteSavedTrek,
    copyTrek,
  } = useTrekActions({
    marketId,
    marketName,
    selectedMarket,
    result,
    rounds,
    digitCount,
    savedTreks,
    persistSavedTreks,
    removeSavedTrek,
    setSavedFlashId,
    setActionError: setScanError,
  });

  const targetText = isPositionMode(scanMode) ? LABEL[targetPos] : TARGET_2D_LABEL[target2D];

  function toggleMarket() {
    if (!isOpen("market")) setMarketQuery("");
    toggleDropdown("market");
  }

  function pilihMarket(market: Market) {
    selectMarket(market);
    closeDropdown();
  }

  function pilihJenis(value: ScanMode) {
    setScanMode(value);
    closeDropdown();
    if (!isShioMode(value) && digitCount > 9) setDigitCount(9);
  }

  function mulaiScan() {
    runScan({
      marketId,
      rounds,
      scanMode,
      targetPos,
      target2D,
      digitCount,
      stopScan,
      onRoundsChange: setRounds,
      onDigitCountChange: setDigitCount,
      onStopScanChange: setStopScan,
      onBeforeRun: () => {
        resetTrekView();
        closeDropdown();
      },
    });
  }

  return (
    <div className="wrap">
      <header className="hero"><div className="hero-kicker">Scanner Rumus Otomatis</div><h1>Scan Angka</h1><p>Cari trek angka dari riwayat result terbaru.</p></header>
      <div className="sync-status">{syncText}</div>

      <ScanControlPanel
        selectedMarket={selectedMarket}
        filteredMarkets={filteredMarkets}
        marketId={marketId}
        marketQuery={marketQuery}
        marketOpen={isOpen("market")}
        jenisOpen={isOpen("jenis")}
        targetOpen={isOpen("target")}
        digitOpen={isOpen("digit")}
        rounds={rounds}
        scanMode={scanMode}
        targetPos={targetPos}
        target2D={target2D}
        targetText={targetText}
        digitCount={digitCount}
        stopScan={stopScan}
        loading={loading}
        error={scanError || marketError}
        onOpenMarket={toggleMarket}
        onCloseMarket={closeDropdown}
        onMarketQueryChange={setMarketQuery}
        onSelectMarket={pilihMarket}
        onRoundsChange={setRounds}
        onSelectJenis={pilihJenis}
        onToggleJenis={() => toggleDropdown("jenis")}
        onToggleTarget={() => toggleDropdown("target")}
        onSelectTargetPos={(value) => { setTargetPos(value); closeDropdown(); }}
        onSelectTarget2D={(value) => { setTarget2D(value); closeDropdown(); }}
        onToggleDigit={() => toggleDropdown("digit")}
        onSelectDigit={(value) => { setDigitCount(value); closeDropdown(); }}
        onStopScanChange={setStopScan}
        onScan={mulaiScan}
      />

      {result && <ScanResultPanel result={result} marketName={marketName} marketId={marketId} savedFlashId={savedFlashId} onSave={saveTrek} onView={openScanItem} />}
      <SavedTreksSection total={savedTreks.length} groups={savedGroups} liveMap={savedLiveMap} onView={setViewSaved} onDelete={deleteSavedTrek} />
      <TrekDetailSheet item={viewItem} selectedMarket={selectedMarket} marketName={marketName} digitCount={digitCount} resultDigitCount={result?.config.digitCount} rows={viewRows} nextPredictionLabels={nextPredictionLabels} copied={copied} onCopy={copyTrek} onClose={() => setViewItem(null)} />
      <SavedTrekSheet saved={viewSaved} liveMap={savedLiveMap} onClose={() => setViewSaved(null)} />

      <BottomNav />
    </div>
  );
}
