"use client";

import { useMemo, useState } from "react";
import BottomNav from "./bottom-nav";
import ScanControlPanel from "./scan/components/ScanControlPanel";
import ScanResultPanel from "./scan/components/ScanResultPanel";
import SavedTreksSection from "./scan/components/SavedTreksSection";
import TrekDetailSheet from "./scan/components/TrekDetailSheet";
import SavedTrekSheet from "./scan/components/SavedTrekSheet";
import { LABEL, TARGET_2D_LABEL } from "./scan/constants";
import { useMarketPicker } from "./scan/hooks/useMarketPicker";
import { useSavedTreks } from "./scan/hooks/useSavedTreks";
import {
  buildCopyText,
  clampTextNumber,
  detailHeaderTitle,
  isPositionMode,
  isShioMode,
  labelsFromValues,
  predictionResult,
  predictionValues,
  savedSignature,
  scanDescription,
  joinValues,
} from "./scan/helpers";
import type { Posisi, SavedTrek, ScanItem, ScanResult, Target2D, ScanMode } from "./scan/types";

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
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [viewItem, setViewItem] = useState<ScanItem | null>(null);
  const [viewSaved, setViewSaved] = useState<SavedTrek | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const viewRows = useMemo(() => viewItem?.result.rows ?? [], [viewItem]);
  const nextPrediction = viewItem ? predictionResult(viewItem) : "";
  const nextPredictionLabels = viewItem ? labelsFromValues(predictionValues(viewItem), viewItem.scanMode) : [];
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

  function saveTrek(item: ScanItem) {
    if (!marketId) return;
    const count = result?.config.digitCount ?? digitCount;
    const L = result?.config.L ?? clampTextNumber(rounds, 14, 1, 100);
    const title = detailHeaderTitle(marketName, selectedMarket);
    const prediction = predictionValues(item);
    const signature = savedSignature(item, marketId);
    const saved: SavedTrek = {
      id: signature,
      marketId,
      marketName: title,
      savedAt: new Date().toISOString(),
      savedLatestDraw: item.result.latestDraw,
      scanMode: item.scanMode,
      targetPos: item.targetPos,
      target2D: item.target2D,
      digitCount: count,
      L,
      formula: item.formula,
      kolomHidup: item.kolomHidup,
      activeColumns: item.activeColumns,
      predictionValues: prediction,
      predictionText: joinValues(prediction, item.scanMode),
      snapshotRows: item.result.rows,
    };
    const next = [saved, ...savedTreks.filter((savedItem) => savedItem.id !== signature)].slice(0, 50);
    persistSavedTreks(next);
    setSavedFlashId(signature);
    window.setTimeout(() => setSavedFlashId(""), 1200);
  }

  function deleteSavedTrek(id: string) {
    removeSavedTrek(id);
    if (viewSaved?.id === id) setViewSaved(null);
  }

  async function copyTrek() {
    if (!viewItem) return;
    const title = detailHeaderTitle(marketName, selectedMarket);
    const description = scanDescription(viewItem.scanMode, viewItem.targetPos, viewItem.target2D, result?.config.digitCount ?? digitCount);
    const text = buildCopyText(viewItem, viewRows, nextPrediction, title, description);
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }
    catch { setError("Gagal salin trek."); }
  }

  async function mulaiScan() {
    setLoading(true); setError(""); setResult(null); setViewItem(null); setViewSaved(null); setCopied(false); setSavedFlashId("");
    try {
      const safeRounds = clampTextNumber(rounds, 14, 1, 100);
      const maxDigit = isShioMode(scanMode) ? 12 : 9;
      const safeDigit = Math.max(1, Math.min(maxDigit, Number(digitCount) || 4));
      const safeStop = clampTextNumber(stopScan, 1, 1, 200);
      setRounds(String(safeRounds)); setDigitCount(safeDigit); setStopScan(String(safeStop));
      const response = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketId, L: safeRounds, targetPos, target2D, digitCount: safeDigit, stopScan: safeStop, scanMode }) });
      const data = await response.json();
      if (data.error) setError(data.error); else { setMarketName(data.market ?? ""); setResult(data.result); }
    } catch {
      setError("Scan gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
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
        error={error || marketError}
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

      {result && <ScanResultPanel result={result} marketName={marketName} marketId={marketId} savedFlashId={savedFlashId} onSave={saveTrek} onView={(item) => { setCopied(false); setViewItem(item); }} />}
      <SavedTreksSection total={savedTreksForMarket.length} groups={savedGroups} liveMap={savedLiveMap} onView={setViewSaved} onDelete={deleteSavedTrek} />
      <TrekDetailSheet item={viewItem} selectedMarket={selectedMarket} marketName={marketName} digitCount={digitCount} resultDigitCount={result?.config.digitCount} rows={viewRows} nextPredictionLabels={nextPredictionLabels} copied={copied} onCopy={copyTrek} onClose={() => setViewItem(null)} />
      <SavedTrekSheet saved={viewSaved} liveMap={savedLiveMap} onClose={() => setViewSaved(null)} />

      <BottomNav />
    </div>
  );
}
