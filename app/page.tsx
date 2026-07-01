"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNav from "./bottom-nav";
import ScanControlPanel from "./scan/components/ScanControlPanel";
import ScanResultPanel from "./scan/components/ScanResultPanel";
import SavedTreksSection from "./scan/components/SavedTreksSection";
import TrekDetailSheet from "./scan/components/TrekDetailSheet";
import SavedTrekSheet from "./scan/components/SavedTrekSheet";
import { LABEL, SAVED_TREK_KEY, TARGET_2D_LABEL } from "./scan/constants";
import {
  buildCopyText,
  buildSavedGroups,
  clampTextNumber,
  detailHeaderTitle,
  formatSyncTime,
  isPositionMode,
  isShioMode,
  isSingapore,
  labelsFromValues,
  marketTitle,
  predictionResult,
  predictionValues,
  savedSignature,
  scanDescription,
  joinValues,
} from "./scan/helpers";
import type { Market, Posisi, SavedLive, SavedTrek, ScanItem, ScanResult, Target2D, ScanMode } from "./scan/types";

export default function Page() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [marketQuery, setMarketQuery] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const [rounds, setRounds] = useState("14");
  const [scanMode, setScanMode] = useState<ScanMode>("ai_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [jenisOpen, setJenisOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [digitCount, setDigitCount] = useState(4);
  const [digitOpen, setDigitOpen] = useState(false);
  const [stopScan, setStopScan] = useState("1");
  const [syncUpdatedAt, setSyncUpdatedAt] = useState<string | null>(null);
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [viewItem, setViewItem] = useState<ScanItem | null>(null);
  const [viewSaved, setViewSaved] = useState<SavedTrek | null>(null);
  const [savedTreks, setSavedTreks] = useState<SavedTrek[]>([]);
  const [savedLiveMap, setSavedLiveMap] = useState<Record<string, SavedLive>>({});
  const [savedFlashId, setSavedFlashId] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedMarket = useMemo(() => markets.find((market) => market.id === marketId) ?? null, [markets, marketId]);
  const filteredMarkets = useMemo(() => {
    const query = marketQuery.trim().toLowerCase();
    if (!query) return markets.slice(0, 30);
    return markets.filter((market) => marketTitle(market).toLowerCase().includes(query)).slice(0, 30);
  }, [markets, marketQuery]);
  const syncText = useMemo(() => formatSyncTime(syncUpdatedAt), [syncUpdatedAt]);
  const viewRows = useMemo(() => viewItem?.result.rows ?? [], [viewItem]);
  const nextPrediction = viewItem ? predictionResult(viewItem) : "";
  const nextPredictionLabels = viewItem ? labelsFromValues(predictionValues(viewItem), viewItem.scanMode) : [];
  const targetText = isPositionMode(scanMode) ? LABEL[targetPos] : TARGET_2D_LABEL[target2D];
  const savedTreksForMarket = useMemo(() => savedTreks.filter((item) => item.marketId === marketId), [savedTreks, marketId]);
  const savedGroups = useMemo(() => buildSavedGroups(savedTreksForMarket), [savedTreksForMarket]);
  const savedRefreshKey = useMemo(() => `${marketId}:${selectedMarket?.latestResult ?? ""}:${savedTreksForMarket.map((item) => `${item.id}:${item.L}:${item.kolomHidup.join("")}`).join("|")}`, [marketId, selectedMarket?.latestResult, savedTreksForMarket]);

  useEffect(() => {
    fetch("/api/markets").then((response) => response.json()).then((data) => {
      if (data.error) return setError(data.error);
      const list: Market[] = data.markets ?? [];
      setMarkets(list);
      setSyncUpdatedAt(data.syncUpdatedAt ?? null);
      const defaultMarket = list.find(isSingapore) ?? list[0];
      if (defaultMarket) setMarketId(defaultMarket.id);
    }).catch(() => setError("Gagal memuat daftar pasaran."));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_TREK_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setSavedTreks(parsed.filter((item) => item?.kolomHidup?.length && item?.L).slice(0, 50));
    } catch {
      setSavedTreks([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (savedTreksForMarket.length === 0) return;

    async function refreshSavedTreks() {
      const updates: Record<string, SavedLive> = {};
      await Promise.all(savedTreksForMarket.map(async (saved) => {
        try {
          const response = await fetch("/api/saved-trek", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ marketId: saved.marketId, formula: saved.formula, scanMode: saved.scanMode, targetPos: saved.targetPos, target2D: saved.target2D, L: saved.L, kolomHidup: saved.kolomHidup }),
          });
          const data = await response.json();
          if (!data.error) updates[saved.id] = data;
        } catch {
          // Tetap pakai snapshot tersimpan jika refresh gagal.
        }
      }));
      if (!cancelled && Object.keys(updates).length) setSavedLiveMap((current) => ({ ...current, ...updates }));
    }

    refreshSavedTreks();
    return () => { cancelled = true; };
  }, [savedRefreshKey]);

  function persistSavedTreks(next: SavedTrek[]) {
    setSavedTreks(next);
    try { localStorage.setItem(SAVED_TREK_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

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

  function pilihMarket(market: Market) {
    setMarketId(market.id);
    setMarketQuery("");
    setMarketOpen(false);
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
    persistSavedTreks(savedTreks.filter((item) => item.id !== id));
    setSavedLiveMap((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
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
        error={error}
        onOpenMarket={bukaMarket}
        onCloseMarket={() => setMarketOpen(false)}
        onMarketQueryChange={setMarketQuery}
        onSelectMarket={pilihMarket}
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
