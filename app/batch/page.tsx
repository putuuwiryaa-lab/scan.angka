"use client";

import { useState } from "react";
import BottomNav from "../bottom-nav";
import BatchSettingsPanel from "./components/BatchSettingsPanel";
import BatchMarketSelector from "./components/BatchMarketSelector";
import BatchOutputPanel from "./components/BatchOutputPanel";
import { useBatchMarkets } from "./hooks/useBatchMarkets";
import { useBatchRunner } from "./hooks/useBatchRunner";
import { isShioMode } from "../shared/scan-utils";
import type { Posisi, ScanMode, Target2D, Target3D } from "../shared/types";

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

  function changeMode(value: ScanMode) {
    setScanMode(value);
    if (!isShioMode(value) && digitCount > 9) setDigitCount(9);
    if ((value === "ai_3d" || value === "bbfs_3d") && digitCount < 7) setDigitCount(7);
    if (value === "off_3d" && digitCount > 3) setDigitCount(3);
  }

  return (
    <main className="batch-page">
      <header className="batch-header">
        <div className="batch-kicker">Scan Batch Publik</div>
        <h1 className="batch-title">Batch Scan</h1>
        <p className="batch-subtitle">Pilih banyak pasaran, scan sekali, output langsung siap copy.</p>
      </header>

      <BatchSettingsPanel
        rounds={rounds}
        scanMode={scanMode}
        targetPos={targetPos}
        target2D={target2D}
        target3D={target3D}
        digitCount={digitCount}
        onRoundsChange={setRounds}
        onScanModeChange={changeMode}
        onTargetPosChange={setTargetPos}
        onTarget2DChange={setTarget2D}
        onTarget3DChange={setTarget3D}
        onDigitCountChange={setDigitCount}
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
          onRoundsChange: setRounds,
          onDigitCountChange: setDigitCount,
        })}
      />

      <BatchOutputPanel result={result} copied={copied} onCopy={copyOutput} />

      <BottomNav />
    </main>
  );
}
