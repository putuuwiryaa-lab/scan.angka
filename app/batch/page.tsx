"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNav from "../bottom-nav";
import BatchSettingsPanel from "./components/BatchSettingsPanel";
import BatchMarketSelector from "./components/BatchMarketSelector";
import BatchOutputPanel from "./components/BatchOutputPanel";
import { MAX_BATCH_MARKETS } from "./constants";
import { batchMarketTitle, outputTitle } from "./helpers";
import { clampTextNumber, isShioMode } from "../scan/helpers";
import type { BatchResult } from "./types";
import type { Market, Posisi, ScanMode, Target2D } from "../scan/types";

export default function BatchPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [rounds, setRounds] = useState("14");
  const [scanMode, setScanMode] = useState<ScanMode>("bbfs_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [digitCount, setDigitCount] = useState(7);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredMarkets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return markets;
    return markets.filter((market) => batchMarketTitle(market).toLowerCase().includes(needle));
  }, [markets, query]);

  useEffect(() => {
    fetch("/api/markets")
      .then((response) => response.json())
      .then((data) => {
        if (data.error) return setError(data.error);
        setMarkets(data.markets ?? []);
      })
      .catch(() => setError("Gagal memuat pasaran."));
  }, []);

  function toggleMarket(id: string) {
    setError("");
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_BATCH_MARKETS) {
        setError(`Maksimal ${MAX_BATCH_MARKETS} pasaran per batch scan.`);
        return current;
      }
      return [...current, id];
    });
  }

  function pilihSemua() {
    setError("");
    const ids = filteredMarkets.map((market) => market.id).slice(0, MAX_BATCH_MARKETS);
    setSelected(ids);
    if (filteredMarkets.length > MAX_BATCH_MARKETS) setError(`Pilih Semua dibatasi ${MAX_BATCH_MARKETS} pasaran pertama.`);
  }

  function kosongkan() {
    setError("");
    setSelected([]);
  }

  function changeMode(value: ScanMode) {
    setScanMode(value);
    if (!isShioMode(value) && digitCount > 9) setDigitCount(9);
  }

  async function runBatch() {
    setLoading(true);
    setError("");
    setResult(null);
    setCopied(false);

    try {
      if (selected.length > MAX_BATCH_MARKETS) {
        setError(`Maksimal ${MAX_BATCH_MARKETS} pasaran per batch scan.`);
        return;
      }

      const safeRounds = clampTextNumber(rounds, 14, 1, 100);
      const safeDigit = Math.max(1, Math.min(isShioMode(scanMode) ? 12 : 9, digitCount));
      const title = outputTitle(scanMode, targetPos, target2D, safeDigit);

      setRounds(String(safeRounds));
      setDigitCount(safeDigit);

      const response = await fetch("/api/batch-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketIds: selected,
          L: safeRounds,
          scanMode,
          targetPos,
          target2D,
          digitCount: safeDigit,
          outputTitle: title,
        }),
      });
      const data = await response.json();
      if (data.error) setError(data.error); else setResult(data);
    } catch {
      setError("Batch scan gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function copyOutput() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Gagal copy output.");
    }
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
        digitCount={digitCount}
        onRoundsChange={setRounds}
        onScanModeChange={changeMode}
        onTargetPosChange={setTargetPos}
        onTarget2DChange={setTarget2D}
        onDigitCountChange={setDigitCount}
      />

      <BatchMarketSelector
        markets={filteredMarkets}
        selected={selected}
        query={query}
        loading={loading}
        error={error}
        onQueryChange={setQuery}
        onSelectAll={pilihSemua}
        onClear={kosongkan}
        onToggleMarket={toggleMarket}
        onRun={runBatch}
      />

      <BatchOutputPanel result={result} copied={copied} onCopy={copyOutput} />

      <BottomNav />
    </main>
  );
}
