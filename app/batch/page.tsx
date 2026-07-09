"use client";

import { useState } from "react";
import BottomNav from "../bottom-nav";
import AppPromoBanner from "../shared/AppPromoBanner";
import BatchSettingsPanel from "./components/BatchSettingsPanel";
import BatchMarketSelector from "./components/BatchMarketSelector";
import BatchOutputPanel from "./components/BatchOutputPanel";
import { useBatchMarkets } from "./hooks/useBatchMarkets";
import { useBatchRunner } from "./hooks/useBatchRunner";
import { isShioMode } from "../shared/scan-utils";
import type { Posisi, ScanMode, Target2D, Target3D } from "../shared/types";

function clampDigitForMode(mode: ScanMode, value: number): number {
  let next = value;
  if (!isShioMode(mode) && next > 9) next = 9;
  if ((mode === "ai_3d" || mode === "bbfs_3d") && next < 7) next = 7;
  if (mode === "off_3d" && next > 3) next = 3;
  return next;
}

export default function BatchPage() {
  const {
    selected,
    query,
    filteredMarkets,
    marketError,
    setQuery,
    toggleMarket,
    selectAll,
    clearSelection,
  } = useBatchMarkets();
  const { result, copied, loading, runnerError, runBatch, copyOutput } = useBatchRunner();

  const [rounds, setRounds] = useState("14");
  const [scanMode, setScanMode] = useState<ScanMode>("bbfs_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [target3D, setTarget3D] = useState<Target3D>("belakang");
  const [digitCount, setDigitCount] = useState(7);
  const [topRanks, setTopRanks] = useState<number[]>([1]);
  const [outputSeparator, setOutputSeparator] = useState("➜");

  const [secondaryScanMode, setSecondaryScanMode] = useState<ScanMode | "">("");
  const [secondaryRounds, setSecondaryRounds] = useState("14");
  const [secondaryTargetPos, setSecondaryTargetPos] = useState<Posisi>("K");
  const [secondaryTarget2D, setSecondaryTarget2D] = useState<Target2D>("belakang");
  const [secondaryTarget3D, setSecondaryTarget3D] = useState<Target3D>("belakang");
  const [secondaryDigitCount, setSecondaryDigitCount] = useState(2);
  const [secondaryTopRanks, setSecondaryTopRanks] = useState<number[]>([1]);

  function changeMode(value: ScanMode) {
    setScanMode(value);
    setDigitCount((current) => clampDigitForMode(value, current));
  }

  function changeSecondaryMode(value: ScanMode | "") {
    setSecondaryScanMode(value);
    if (value) setSecondaryDigitCount((current) => clampDigitForMode(value, current));
  }

  return (
    <main className="batch-page">
      <header className="batch-header">
        <div className="batch-kicker">Scan Batch Publik</div>
        <h1 className="batch-title">Batch Scan</h1>
        <p className="batch-subtitle">Pilih banyak pasaran, scan sekali, output langsung siap copy.</p>
      </header>

      <AppPromoBanner />

      <BatchSettingsPanel
        rounds={rounds}
        scanMode={scanMode}
        targetPos={targetPos}
        target2D={target2D}
        target3D={target3D}
        digitCount={digitCount}
        topRanks={topRanks}
        outputSeparator={outputSeparator}
        secondaryScanMode={secondaryScanMode}
        secondaryRounds={secondaryRounds}
        secondaryTargetPos={secondaryTargetPos}
        secondaryTarget2D={secondaryTarget2D}
        secondaryTarget3D={secondaryTarget3D}
        secondaryDigitCount={secondaryDigitCount}
        secondaryTopRanks={secondaryTopRanks}
        onRoundsChange={setRounds}
        onScanModeChange={changeMode}
        onTargetPosChange={setTargetPos}
        onTarget2DChange={setTarget2D}
        onTarget3DChange={setTarget3D}
        onDigitCountChange={setDigitCount}
        onTopRanksChange={setTopRanks}
        onOutputSeparatorChange={setOutputSeparator}
        onSecondaryScanModeChange={changeSecondaryMode}
        onSecondaryRoundsChange={setSecondaryRounds}
        onSecondaryTargetPosChange={setSecondaryTargetPos}
        onSecondaryTarget2DChange={setSecondaryTarget2D}
        onSecondaryTarget3DChange={setSecondaryTarget3D}
        onSecondaryDigitCountChange={setSecondaryDigitCount}
        onSecondaryTopRanksChange={setSecondaryTopRanks}
      />

      <BatchMarketSelector
        markets={filteredMarkets}
        selected={selected}
        query={query}
        loading={loading}
        error={runnerError || marketError}
        onQueryChange={setQuery}
        onSelectAll={selectAll}
        onClear={clearSelection}
        onToggleMarket={toggleMarket}
        onRun={() => runBatch({
          selected,
          rounds,
          scanMode,
          targetPos,
          target2D,
          target3D,
          digitCount,
          topRanks,
          lineSeparator: outputSeparator,
          secondaryScanMode,
          secondaryRounds,
          secondaryTargetPos,
          secondaryTarget2D,
          secondaryTarget3D,
          secondaryDigitCount,
          secondaryTopRanks,
          onRoundsChange: setRounds,
          onDigitCountChange: setDigitCount,
          onTopRanksChange: setTopRanks,
          onSecondaryRoundsChange: setSecondaryRounds,
          onSecondaryDigitCountChange: setSecondaryDigitCount,
          onSecondaryTopRanksChange: setSecondaryTopRanks,
        })}
      />

      <BatchOutputPanel result={result} copied={copied} onCopy={copyOutput} />

      <BottomNav />
    </main>
  );
}
