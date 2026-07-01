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
import { useScanRunner } from "./scan/hooks/useScanRunner";
import { useTrekActions } from "./scan/hooks/useTrekActions";
import { isPositionMode, isShioMode } from "./shared/scan-utils";
import type { Posisi, ScanMode, Target2D } from "./scan/types";

export default function Page() {
  const {
    marketId,
    marketQuery,
    marketOpen,
    selectedMarket,
    filteredMarkets,
    syncText,
    marketError,
    setMarketQuery,
    setMarketOpen,
    selectMarket,
  } = useMarketPicker();

  const [rounds, setRounds] = useState("14");
  const [scanMode, setScanMode] = useState<ScanMode>("ai_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [jenisOpen, setJenisOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [digitCount, setDigitCount] = useState(4);
  const [digitOpen, setDigitOpen] = useState(false);
  const [stopScan, setStopScan] = useState("1");

  const { marketName, result, loading, scanError, setScanError, runScan } = useScanRunner();
  const {
    savedTreks,
    savedTreksForMarket,
    savedGroups,
    savedLiveMap,
    savedFlashId,
    setSavedFlashId,
    persistSavedTreks,
    deleteSavedTrek: removeSavedTrek,
  } = useSavedTreks(marketId, selectedMarket?.latestResult);
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

  function bukaMarket() {
    if (marketOpen) {
      setMarketOpen(false);
      return;
    }
    setMarketQuery("");
    setJenisOpen(false);
    setTargetOpen(false);
    setDigitOpen(false);
    setMarketOpen(true);
  }

  function toggleJenis() {
    setMarketOpen(false);
    setTargetOpen(false);
    setDigitOpen(false);
    setJenisOpen((open) => !open);
  }

  function pilihJenis(value: ScanMode) {
    setScanMode(value);
    setJenisOpen(false);
    if (!isShioMode(value) && digitCount > 9) setDigitCount(9);
  }

  function toggleTarget() {
    setMarketOpen(false);
    setJenisOpen(false);
    setDigitOpen(false);
    setTargetOpen((open) => !open);
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
      onBeforeRun: resetTrekView,
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
        marketOpen={marketOpen}
        jenisOpen={jenisOpen}
        targetOpen={targetOpen}
        digitOpen={digitOpen}
        rounds={rounds}
        scanMode={scanMode}
        targetPos={targetPos}
        target2D={target2D}
        targetText={targetText}
        digitCount={digitCount}
        stopScan={stopScan}
        loading={loading}
        error={scanError || marketError}
        onOpenMarket={bukaMarket}
        onCloseMarket={() => setMarketOpen(false)}
        onMarketQueryChange={setMarketQuery}
        onSelectMarket={selectMarket}
        onRoundsChange={setRounds}
        onSelectJenis={pilihJenis}
        onToggleJenis={toggleJenis}
        onToggleTarget={toggleTarget}
        onSelectTargetPos={(value) => { setTargetPos(value); setTargetOpen(false); }}
        onSelectTarget2D={(value) => { setTarget2D(value); setTargetOpen(false); }}
        onToggleDigit={() => { setMarketOpen(false); setJenisOpen(false); setTargetOpen(false); setDigitOpen((open) => !open); }}
        onSelectDigit={(value) => { setDigitCount(value); setDigitOpen(false); }}
        onStopScanChange={setStopScan}
        onScan={mulaiScan}
      />

      {result && <ScanResultPanel result={result} marketName={marketName} marketId={marketId} savedFlashId={savedFlashId} onSave={saveTrek} onView={openScanItem} />}
      <SavedTreksSection total={savedTreksForMarket.length} groups={savedGroups} liveMap={savedLiveMap} onView={setViewSaved} onDelete={deleteSavedTrek} />
      <TrekDetailSheet item={viewItem} selectedMarket={selectedMarket} marketName={marketName} digitCount={digitCount} resultDigitCount={result?.config.digitCount} rows={viewRows} nextPredictionLabels={nextPredictionLabels} copied={copied} onCopy={copyTrek} onClose={() => setViewItem(null)} />
      <SavedTrekSheet saved={viewSaved} liveMap={savedLiveMap} onClose={() => setViewSaved(null)} />

      <BottomNav />
    </div>
  );
}
