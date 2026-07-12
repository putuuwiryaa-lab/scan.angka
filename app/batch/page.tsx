"use client";

import { useState } from "react";
import BottomNav from "../bottom-nav";
import AppPromoBanner from "../shared/AppPromoBanner";
import BatchSettingsPanel from "./components/BatchSettingsPanel";
import BatchMarketSelector from "./components/BatchMarketSelector";
import BatchOutputPanel from "./components/BatchOutputPanel";
import { useBatchMarkets } from "./hooks/useBatchMarkets";
import { useBatchRunner } from "./hooks/useBatchRunner";
import { MAX_ADAPTIVE_BATCH_MARKETS, MAX_BATCH_MARKETS } from "./constants";
import {
  clampBatchDigitCount,
  isAdaptiveBatchMode,
  type BatchAnalysisMode,
} from "../../lib/shared/batch-analysis";
import type { Posisi, Target2D, Target3D } from "../shared/types";

export default function BatchPage() {
  const [rounds, setRounds] = useState("14");
  const [scanMode, setScanMode] = useState<BatchAnalysisMode>("bbfs_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [target3D, setTarget3D] = useState<Target3D>("belakang");
  const [digitCount, setDigitCount] = useState(7);
  const [topRanks, setTopRanks] = useState<number[]>([1]);
  const [outputSeparator, setOutputSeparator] = useState("➜");

  const [secondaryScanMode, setSecondaryScanMode] = useState<BatchAnalysisMode | "">("");
  const [secondaryRounds, setSecondaryRounds] = useState("14");
  const [secondaryTargetPos, setSecondaryTargetPos] = useState<Posisi>("K");
  const [secondaryTarget2D, setSecondaryTarget2D] = useState<Target2D>("belakang");
  const [secondaryTarget3D, setSecondaryTarget3D] = useState<Target3D>("belakang");
  const [secondaryDigitCount, setSecondaryDigitCount] = useState(2);
  const [secondaryTopRanks, setSecondaryTopRanks] = useState<number[]>([1]);

  const adaptiveBatch = isAdaptiveBatchMode(scanMode) ||
    (Boolean(secondaryScanMode) && isAdaptiveBatchMode(secondaryScanMode));
  const maxMarkets = adaptiveBatch ? MAX_ADAPTIVE_BATCH_MARKETS : MAX_BATCH_MARKETS;

  const {
    selected,
    query,
    filteredMarkets,
    marketError,
    setQuery,
    toggleMarket,
    selectAll,
    clearSelection,
  } = useBatchMarkets(maxMarkets);
  const { result, copied, loading, progress, runnerError, runBatch, copyOutput } = useBatchRunner();

  function changeMode(value: BatchAnalysisMode) {
    setScanMode(value);
    setDigitCount((current) => clampBatchDigitCount(value, current));
  }

  function changeSecondaryMode(value: BatchAnalysisMode | "") {
    setSecondaryScanMode(value);
    if (value) setSecondaryDigitCount((current) => clampBatchDigitCount(value, current));
  }

  return (
    <main className="batch-page">
      <header className="batch-header">
        <div className="batch-kicker">ANALISIS MULTI-PASARAN</div>
        <h1 className="batch-title">Batch Scan & Adaptif</h1>
        <p className="batch-subtitle">Jalankan Scan Rumus atau turnamen Adaptif untuk beberapa pasaran dalam satu proses.</p>
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
        progress={progress}
        error={runnerError || marketError}
        maxMarkets={maxMarkets}
        adaptive={adaptiveBatch}
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
