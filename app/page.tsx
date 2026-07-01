"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import BottomNav from "./bottom-nav";

type Posisi = "A" | "C" | "K" | "E";
type Target2D = "depan" | "tengah" | "belakang";
type ScanMode = "posisi" | "ai_2d_belakang" | "bbfs_2d_belakang" | "jumlah_2d_belakang" | "off_posisi" | "off_2d_belakang" | "off_jumlah_2d_belakang" | "shio" | "off_shio";
type Market = { id: string; name: string | null; latestResult?: string | null; updatedAt?: string | null };
type ScanRow = { displayDraw: string; patokanDraw: string; targetDraw: string; targetDigit: number; targetDigits?: number[]; deret: number[] };
type ScanItem = {
  targetPos: Posisi;
  target2D: Target2D;
  scanMode: ScanMode;
  formula: string;
  angkaHidup: number[];
  kolomHidup: string[];
  activeColumns: string;
  result: { rows: ScanRow[]; patokanLiveDraw: string; latestDraw: string; deretLive: number[] };
};
type ScanResult = { config: { L: number; targetPos: Posisi; target2D: Target2D; digitCount: number; stopScan: number; scanMode: ScanMode }; totalChecked: number; totalMatched: number; items: ScanItem[] };
type FrequencyRow = { digit: number; count: number };

const ANALYSIS_OPTIONS: { value: ScanMode; label: string }[] = [
  { value: "posisi", label: "Trek Posisi" },
  { value: "ai_2d_belakang", label: "AI 2D" },
  { value: "bbfs_2d_belakang", label: "BBFS 2D" },
  { value: "jumlah_2d_belakang", label: "Jumlah 2D" },
  { value: "shio", label: "Shio" },
  { value: "off_posisi", label: "OFF Posisi" },
  { value: "off_2d_belakang", label: "OFF 2D" },
  { value: "off_jumlah_2d_belakang", label: "OFF Jumlah 2D" },
  { value: "off_shio", label: "OFF Shio" },
];
const POS_OPTIONS: { value: Posisi; label: string }[] = [
  { value: "A", label: "AS" },
  { value: "C", label: "COP" },
  { value: "K", label: "KPL" },
  { value: "E", label: "EKR" },
];
const TARGET_2D_OPTIONS: { value: Target2D; label: string }[] = [
  { value: "depan", label: "Depan" },
  { value: "tengah", label: "Tengah" },
  { value: "belakang", label: "Belakang" },
];
const LABEL: Record<Posisi, string> = { A: "AS", C: "COP", K: "KPL", E: "EKR" };
const NAME: Record<Posisi, string> = { A: "as", C: "cop", K: "kepala", E: "ekor" };
const SHORT: Record<Posisi, string> = { A: "a", C: "c", K: "k", E: "e" };
const ANALYSIS_LABEL: Record<ScanMode, string> = {
  posisi: "Trek Posisi",
  ai_2d_belakang: "AI 2D",
  bbfs_2d_belakang: "BBFS 2D",
  jumlah_2d_belakang: "Jumlah 2D",
  shio: "Shio",
  off_posisi: "OFF Posisi",
  off_2d_belakang: "OFF 2D",
  off_jumlah_2d_belakang: "OFF Jumlah 2D",
  off_shio: "OFF Shio",
};
const TARGET_2D_LABEL: Record<Target2D, string> = { depan: "Depan", tengah: "Tengah", belakang: "Belakang" };
const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const SHIO_COLS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"];
const DIGIT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const NO_BADGE_SELECT_STYLE: CSSProperties = { gridTemplateColumns: "minmax(0,1fr) 24px" };
const NO_BADGE_OPTION_STYLE: CSSProperties = { gridTemplateColumns: "minmax(0,1fr) auto" };
const DATA_HINT_FIELD_STYLE: CSSProperties = { position: "relative" };
const DATA_HINT_INPUT_STYLE: CSSProperties = { paddingRight: 76 };
const DATA_HINT_STYLE: CSSProperties = { position: "absolute", right: 12, bottom: 14, color: "rgba(233,238,245,.34)", fontSize: 12, fontWeight: 900, pointerEvents: "none" };

function isPositionMode(mode: ScanMode) { return mode === "posisi" || mode === "off_posisi"; }
function isOffMode(mode: ScanMode) { return mode === "off_posisi" || mode === "off_2d_belakang" || mode === "off_jumlah_2d_belakang" || mode === "off_shio"; }
function isShioMode(mode: ScanMode) { return mode === "shio" || mode === "off_shio"; }
function pickColumns(columns: string[], deret: number[]) {
  const source = deret.length === 12 ? SHIO_COLS : COLS;
  return columns.map((c) => deret[source.indexOf(c)]).filter((n) => Number.isFinite(n));
}
function marketTitle(market: Market) { return market.name ?? market.id; }
function isSingapore(market: Market) { const text = `${market.id} ${market.name ?? ""}`.toLowerCase(); return text.includes("singapore") || text.includes("sgp"); }
function cleanDigits(value: string, maxLength = 3) { return value.replace(/\D/g, "").slice(0, maxLength); }
function clampTextNumber(value: string, fallback: number, min: number, max: number) { const parsed = Number(value); if (!Number.isFinite(parsed) || parsed < min) return fallback; return Math.max(min, Math.min(max, Math.trunc(parsed))); }
function formatSyncTime(value: string | null) {
  if (!value) return "Sinkron data belum tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sinkron data belum tersedia";
  return `Terakhir sinkron data: ${date.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}
function shioLabel(value: number) { return String(value + 1).padStart(2, "0"); }
function labelValue(value: number, mode: ScanMode) { return isShioMode(mode) ? shioLabel(value) : String(value); }
function labelsFromValues(values: number[], mode: ScanMode) { return values.map((value) => labelValue(value, mode)); }
function joinValues(values: number[], mode: ScanMode) { return labelsFromValues(values, mode).join(isShioMode(mode) ? "-" : ""); }
function buildFrequencies(items: ScanItem[]): FrequencyRow[] {
  const max = items.some((item) => isShioMode(item.scanMode)) ? 12 : 10;
  const counts = Array.from({ length: max }, () => 0);
  for (const item of items) {
    const uniqueDigits = new Set(item.angkaHidup.filter((digit) => digit >= 0 && digit < max));
    uniqueDigits.forEach((digit) => { counts[digit] += 1; });
  }
  return counts.map((count, digit) => ({ digit, count })).sort((a, b) => b.count - a.count || a.digit - b.digit);
}
function targetDigits(row: ScanRow) { return row.targetDigits?.length ? row.targetDigits : [row.targetDigit]; }
function rowResultDigits(item: ScanItem, row: ScanRow) {
  const targets = targetDigits(row);
  return pickColumns(item.kolomHidup, row.deret).map((digit) => ({ digit, hit: targets.includes(digit) }));
}
function rowResultText(item: ScanItem, row: ScanRow) { return joinValues(rowResultDigits(item, row).map(({ digit }) => digit), item.scanMode); }
function rowStatus(item: ScanItem, row: ScanRow) {
  const results = rowResultDigits(item, row);
  if (isOffMode(item.scanMode)) return results.some(({ hit }) => hit) ? "❌" : "✅";
  if (item.scanMode === "bbfs_2d_belakang") {
    const resultDigits = results.map(({ digit }) => digit);
    return targetDigits(row).every((digit) => resultDigits.includes(digit)) ? "✅" : "❌";
  }
  return results.some(({ hit }) => hit) ? "✅" : "❌";
}
function predictionValues(item: ScanItem) { return pickColumns(item.kolomHidup, item.result.deretLive); }
function predictionResult(item: ScanItem) { return joinValues(predictionValues(item), item.scanMode); }
function analysisTitle(mode: ScanMode, targetPos: Posisi, target2D: Target2D) {
  if (isPositionMode(mode)) return `${ANALYSIS_LABEL[mode]} ${LABEL[targetPos]}`;
  return `${ANALYSIS_LABEL[mode]} ${TARGET_2D_LABEL[target2D]}`;
}
function scanDescription(mode: ScanMode, targetPos: Posisi, target2D: Target2D, count: number) {
  const unit = isShioMode(mode) ? "shio" : "digit";
  return `${analysisTitle(mode, targetPos, target2D)} ${count} ${unit}`;
}
function detailHeaderTitle(marketName: string, selectedMarket: Market | null) {
  return marketName || (selectedMarket ? marketTitle(selectedMarket) : "Pasaran");
}
function detailTitle(item: ScanItem) {
  if (item.scanMode === "posisi") return `Detail Trek ${NAME[item.targetPos]} (${SHORT[item.targetPos]})`;
  return `Detail ${analysisTitle(item.scanMode, item.targetPos, item.target2D)}`;
}
function buildCopyText(item: ScanItem, rows: ScanRow[], nextPrediction: string, title: string, description: string) {
  const header = [title, description];
  const history = rows.map((row) => `${row.displayDraw} ➜ ${rowResultText(item, row)} ${rowStatus(item, row)}`);
  const next = `${item.result.latestDraw} ➜ ${nextPrediction} ??`;
  return [...header, "", ...history, next].join("\n");
}

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
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedMarket = useMemo(() => markets.find((m) => m.id === marketId) ?? null, [markets, marketId]);
  const filteredMarkets = useMemo(() => {
    const query = marketQuery.trim().toLowerCase();
    if (!query) return markets.slice(0, 30);
    return markets.filter((m) => marketTitle(m).toLowerCase().includes(query)).slice(0, 30);
  }, [markets, marketQuery]);
  const syncText = useMemo(() => formatSyncTime(syncUpdatedAt), [syncUpdatedAt]);
  const frequencies = useMemo(() => result ? buildFrequencies(result.items) : [], [result]);
  const viewRows = useMemo(() => viewItem?.result.rows ?? [], [viewItem]);
  const nextPrediction = viewItem ? predictionResult(viewItem) : "";
  const nextPredictionLabels = viewItem ? labelsFromValues(predictionValues(viewItem), viewItem.scanMode) : [];
  const targetText = isPositionMode(scanMode) ? LABEL[targetPos] : TARGET_2D_LABEL[target2D];

  useEffect(() => {
    fetch("/api/markets").then((r) => r.json()).then((d) => {
      if (d.error) return setError(d.error);
      const list: Market[] = d.markets ?? [];
      setMarkets(list);
      setSyncUpdatedAt(d.syncUpdatedAt ?? null);
      const defaultMarket = list.find(isSingapore) ?? list[0];
      if (defaultMarket) setMarketId(defaultMarket.id);
    }).catch(() => setError("Gagal memuat daftar pasaran."));
  }, []);

  function bukaMarket() { if (marketOpen) { setMarketOpen(false); return; } setMarketQuery(""); setJenisOpen(false); setTargetOpen(false); setDigitOpen(false); setMarketOpen(true); }
  function pilihMarket(market: Market) { setMarketId(market.id); setMarketQuery(""); setMarketOpen(false); }
  function toggleJenis() { setMarketOpen(false); setTargetOpen(false); setDigitOpen(false); setJenisOpen((open) => !open); }
  function pilihJenis(value: ScanMode) { setScanMode(value); setJenisOpen(false); if (!isShioMode(value) && digitCount > 9) setDigitCount(9); }
  function toggleTarget() { setMarketOpen(false); setJenisOpen(false); setDigitOpen(false); setTargetOpen((open) => !open); }
  function toggleDigit() { setMarketOpen(false); setJenisOpen(false); setTargetOpen(false); setDigitOpen((open) => !open); }
  function pilihDigit(value: number) { setDigitCount(value); setDigitOpen(false); }

  async function copyTrek() {
    if (!viewItem) return;
    const title = detailHeaderTitle(marketName, selectedMarket);
    const description = scanDescription(viewItem.scanMode, viewItem.targetPos, viewItem.target2D, result?.config.digitCount ?? digitCount);
    const text = buildCopyText(viewItem, viewRows, nextPrediction, title, description);
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }
    catch { setError("Gagal salin trek."); }
  }

  async function mulaiScan() {
    setLoading(true); setError(""); setResult(null); setViewItem(null); setCopied(false);
    try {
      const safeRounds = clampTextNumber(rounds, 14, 1, 100);
      const maxDigit = isShioMode(scanMode) ? 12 : 9;
      const safeDigit = Math.max(1, Math.min(maxDigit, Number(digitCount) || 4));
      const safeStop = clampTextNumber(stopScan, 1, 1, 200);
      setRounds(String(safeRounds)); setDigitCount(safeDigit); setStopScan(String(safeStop));
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketId, L: safeRounds, targetPos, target2D, digitCount: safeDigit, stopScan: safeStop, scanMode }) });
      const d = await res.json();
      if (d.error) setError(d.error); else { setMarketName(d.market ?? ""); setResult(d.result); }
    } catch { setError("Scan gagal. Coba lagi."); }
    finally { setLoading(false); }
  }

  return (
    <div className="wrap">
      <header className="hero"><div className="hero-kicker">Scanner Rumus Otomatis</div><h1>Scan Angka</h1><p>Cari trek angka dari riwayat result terbaru.</p></header>
      <div className="sync-status">{syncText}</div>

      <div className="panel">
        <div className="field market-field">
          <label>Pasaran</label>
          <button className="market-select" type="button" onClick={bukaMarket}><span className="select-badge" /><b>{selectedMarket ? marketTitle(selectedMarket) : "Pilih pasaran"}</b><span className="latest-result">{selectedMarket?.latestResult ?? "----"}</span><span className="select-arrow">{marketOpen ? "⌃" : "⌄"}</span></button>
          {marketOpen && <div className="market-menu"><div className="market-menu-top"><input className="market-search" value={marketQuery} onChange={(e) => setMarketQuery(e.target.value)} placeholder="Cari pasaran..." autoFocus /><button type="button" onClick={() => setMarketOpen(false)}>×</button></div>{filteredMarkets.length === 0 && <div className="market-empty">Pasaran tidak ditemukan</div>}{filteredMarkets.map((m) => <button key={m.id} type="button" className={m.id === marketId ? "market-option active" : "market-option"} onClick={() => pilihMarket(m)}><span className="option-badge" /><span className="option-label">{marketTitle(m)}</span>{m.latestResult && <em>{m.latestResult}</em>}{m.id === marketId && <b>✓</b>}</button>)}</div>}
        </div>

        <div className="row two">
          <div className="field" style={DATA_HINT_FIELD_STYLE}><label>Data Uji</label><input inputMode="numeric" style={DATA_HINT_INPUT_STYLE} value={rounds} onChange={(e) => setRounds(cleanDigits(e.target.value, 3))} onBlur={() => setRounds(String(clampTextNumber(rounds, 14, 1, 100)))} /><span style={DATA_HINT_STYLE}>maks.100</span></div>
          <div className="field trek-field"><label>Jenis</label><button className="trek-select" style={NO_BADGE_SELECT_STYLE} type="button" onClick={toggleJenis}><b>{ANALYSIS_LABEL[scanMode]}</b><span className="select-arrow">{jenisOpen ? "⌃" : "⌄"}</span></button>{jenisOpen && <div className="trek-menu">{ANALYSIS_OPTIONS.map((item) => <button key={item.value} type="button" style={NO_BADGE_OPTION_STYLE} className={item.value === scanMode ? "trek-option active" : "trek-option"} onClick={() => pilihJenis(item.value)}><span className="option-label">{item.label}</span>{item.value === scanMode && <b>✓</b>}</button>)}</div>}</div>
        </div>

        <div className="row two">
          <div className="field trek-field"><label>Target</label><button className="trek-select" style={NO_BADGE_SELECT_STYLE} type="button" onClick={toggleTarget}><b>{targetText}</b><span className="select-arrow">{targetOpen ? "⌃" : "⌄"}</span></button>{targetOpen && <div className="trek-menu">{isPositionMode(scanMode) ? POS_OPTIONS.map((item) => <button key={item.value} type="button" style={NO_BADGE_OPTION_STYLE} className={item.value === targetPos ? "trek-option active" : "trek-option"} onClick={() => { setTargetPos(item.value); setTargetOpen(false); }}><span className="option-label">{item.label}</span>{item.value === targetPos && <b>✓</b>}</button>) : TARGET_2D_OPTIONS.map((item) => <button key={item.value} type="button" style={NO_BADGE_OPTION_STYLE} className={item.value === target2D ? "trek-option active" : "trek-option"} onClick={() => { setTarget2D(item.value); setTargetOpen(false); }}><span className="option-label">{item.label}</span>{item.value === target2D && <b>✓</b>}</button>)}</div>}</div>
          <div className="field digit-field"><label>{isOffMode(scanMode) ? (isShioMode(scanMode) ? "Jumlah OFF Shio" : "Jumlah OFF") : (isShioMode(scanMode) ? "Jumlah Shio" : "Jumlah Digit")}</label><button className="digit-select" style={NO_BADGE_SELECT_STYLE} type="button" onClick={toggleDigit}><b>{digitCount} {isShioMode(scanMode) ? "shio" : "digit"}</b><span className="select-arrow">{digitOpen ? "⌃" : "⌄"}</span></button>{digitOpen && <div className="digit-menu">{DIGIT_OPTIONS.filter((value) => isShioMode(scanMode) || value <= 9).map((value) => <button key={value} type="button" style={NO_BADGE_OPTION_STYLE} className={value === digitCount ? "digit-option active" : "digit-option"} onClick={() => pilihDigit(value)}><span className="option-label">{value} {isShioMode(scanMode) ? "shio" : "digit"}</span>{value === digitCount && <b>✓</b>}</button>)}</div>}</div>
        </div>

        <div className="field"><label>Batas Hasil</label><input inputMode="numeric" value={stopScan} onChange={(e) => setStopScan(cleanDigits(e.target.value, 3))} onBlur={() => setStopScan(String(clampTextNumber(stopScan, 1, 1, 200)))} /></div>
        <button className="run" onClick={mulaiScan} disabled={loading || !marketId}>{loading ? "Sedang scan..." : "Scan Sekarang"}</button>
        {error && <div className="err">{error}</div>}
      </div>

      {result && <div className="panel result-panel"><p className="summary"><b>{marketName}</b> &middot; <b>{analysisTitle(result.config.scanMode, result.config.targetPos, result.config.target2D)}</b> &middot; {result.config.digitCount} {isShioMode(result.config.scanMode) ? "shio" : "digit"} &middot; {result.totalMatched} hasil</p><div className="scan-list compact-list">{result.items.length === 0 && <div className="scan-empty">Belum ada trek yang cocok.</div>}{result.items.map((item, index) => <div className="scan-item compact" key={`${item.scanMode}-${item.targetPos}-${item.target2D}-${item.formula}-${index}`}><span className="scan-formula compact-formula">{item.formula}</span><div className="compact-digits">{labelsFromValues(item.angkaHidup, item.scanMode).map((digit, digitIndex) => <span key={`${digit}-${digitIndex}`}>{digit}</span>)}</div><button className="view-btn compact-view" type="button" onClick={() => { setCopied(false); setViewItem(item); }}>Lihat</button></div>)}</div>{result.items.length > 0 && <div className="frequency-block"><div className="frequency-head"><b>Frekuensi</b><span>{result.items.length} rumus</span></div><p>Kemunculan kandidat dari hasil scan.</p><div className="frequency-grid">{frequencies.map((item) => <div className={item.count === 0 ? "frequency-item muted" : "frequency-item"} key={item.digit}><b>{labelValue(item.digit, result.config.scanMode)}</b><i>=</i><span>{item.count}x</span></div>)}</div></div>}</div>}

      {viewItem && <div className="sheet-bg" onClick={() => setViewItem(null)}><div className="sheet" onClick={(e) => e.stopPropagation()}><div className="sheet-head"><div><b>{detailHeaderTitle(marketName, selectedMarket)}</b><span>{scanDescription(viewItem.scanMode, viewItem.targetPos, viewItem.target2D, result?.config.digitCount ?? digitCount)}</span></div><div className="sheet-actions"><button className="copy-btn" type="button" onClick={copyTrek}>{copied ? "Tersalin" : "Salin Trek"}</button><button className="close-btn" type="button" onClick={() => setViewItem(null)}>×</button></div></div><div className="trek-detail">{viewRows.map((row, idx) => <div className="trek-row" key={`${row.displayDraw}-${idx}`}><span>{row.displayDraw}</span><i>➜</i><b className="row-digits">{rowResultDigits(viewItem, row).map(({ digit, hit }, digitIndex) => <span key={`${digit}-${digitIndex}`} className={hit ? "hit-digit" : ""}>{labelValue(digit, viewItem.scanMode)}</span>)}</b><em>{rowStatus(viewItem, row)}</em></div>)}<div className="trek-row pending"><span>{viewItem.result.latestDraw}</span><i>➜</i><b className="row-digits">{nextPredictionLabels.map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}</b><em>??</em></div></div></div></div>}

      <BottomNav />
    </div>
  );
}
