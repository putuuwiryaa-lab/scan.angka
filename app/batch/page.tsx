"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import BottomNav from "../bottom-nav";

type Posisi = "A" | "C" | "K" | "E";
type Target2D = "depan" | "tengah" | "belakang";
type ScanMode = "posisi" | "ai_2d_belakang" | "bbfs_2d_belakang" | "jumlah_2d_belakang" | "off_posisi" | "off_2d_belakang" | "off_jumlah_2d_belakang" | "shio" | "off_shio";
type Market = { id: string; name: string | null; latestResult?: string | null };
type BatchResult = { title: string; copyText: string; results: { id: string; name: string; digits: string }[] };

const MAX_BATCH_MARKETS = 30;
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
const DIGIT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const POS_LABEL: Record<Posisi, string> = { A: "AS", C: "COP", K: "KPL", E: "EKR" };
const MODE_LABEL: Record<ScanMode, string> = {
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

function titleCase(value: string) { return value.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`); }
function marketTitle(market: Market) { return titleCase(market.name ?? market.id); }
function isPositionMode(mode: ScanMode) { return mode === "posisi" || mode === "off_posisi"; }
function isOffMode(mode: ScanMode) { return mode === "off_posisi" || mode === "off_2d_belakang" || mode === "off_jumlah_2d_belakang" || mode === "off_shio"; }
function isShioMode(mode: ScanMode) { return mode === "shio" || mode === "off_shio"; }
function outputTitle(scanMode: ScanMode, targetPos: Posisi, target2D: Target2D, digitCount: number) {
  const target = isPositionMode(scanMode) ? POS_LABEL[targetPos] : TARGET_2D_LABEL[target2D];
  return `${MODE_LABEL[scanMode]} ${target} ${digitCount}${isShioMode(scanMode) ? " Shio" : "D"}`;
}
function cleanDigits(value: string, maxLength = 3) { return value.replace(/\D/g, "").slice(0, maxLength); }
function clampTextNumber(value: string, fallback: number, min: number, max: number) { const parsed = Number(value); if (!Number.isFinite(parsed) || parsed < min) return fallback; return Math.max(min, Math.min(max, Math.trunc(parsed))); }

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 820, margin: "0 auto", padding: "18px 12px 118px" },
  header: { padding: "18px 4px 12px" },
  kicker: { color: "#8b97a8", fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" },
  title: { margin: "5px 0 0", fontSize: 34, lineHeight: 1, fontWeight: 950, letterSpacing: -1 },
  sub: { margin: "8px 0 0", color: "#aeb9c9", fontSize: 13, fontWeight: 750 },
  panel: { background: "#161b22", border: "1px solid #283040", borderRadius: 16, padding: 14, marginTop: 12 },
  rowTwo: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  field: { marginBottom: 10 },
  label: { display: "block", color: "#8b97a8", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  input: { width: "100%", minHeight: 44, background: "#1c2330", border: "1px solid #283040", color: "#e9eef5", borderRadius: 10, padding: "10px 11px", fontSize: 14, fontWeight: 800 },
  select: { width: "100%", minHeight: 44, background: "#1c2330", border: "1px solid #283040", color: "#e9eef5", borderRadius: 10, padding: "10px 11px", fontSize: 14, fontWeight: 850 },
  tools: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  smallBtn: { border: "1px solid rgba(110,155,255,.35)", background: "rgba(110,155,255,.10)", color: "#cfe0ff", borderRadius: 999, padding: "8px 11px", fontWeight: 900, fontSize: 12 },
  search: { width: "100%", minHeight: 42, background: "#101723", border: "1px solid #283040", color: "#e9eef5", borderRadius: 12, padding: "9px 12px", fontSize: 14, fontWeight: 800, marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  run: { width: "100%", minHeight: 46, marginTop: 12, border: 0, borderRadius: 12, background: "#6e9bff", color: "#07111f", fontSize: 15, fontWeight: 950 },
  error: { marginTop: 10, border: "1px solid #ff5d5d", color: "#ff5d5d", background: "rgba(255,93,93,.08)", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 800 },
  output: { width: "100%", minHeight: 240, background: "#101723", border: "1px solid #283040", color: "#e9eef5", borderRadius: 12, padding: 12, fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 800, lineHeight: 1.55, whiteSpace: "pre-wrap" },
  copy: { width: "100%", minHeight: 42, marginTop: 10, border: "1px solid rgba(224,179,65,.35)", borderRadius: 12, background: "rgba(224,179,65,.12)", color: "#e0b341", fontSize: 14, fontWeight: 950 },
  meta: { color: "#8b97a8", fontSize: 12, fontWeight: 800, margin: "0 0 10px" },
  notice: { marginTop: 8, color: "#8b97a8", fontSize: 12, fontWeight: 800 },
};

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

  const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); if (!needle) return markets; return markets.filter((market) => marketTitle(market).toLowerCase().includes(needle)); }, [markets, query]);

  useEffect(() => { fetch("/api/markets").then((r) => r.json()).then((d) => { if (d.error) return setError(d.error); setMarkets(d.markets ?? []); }).catch(() => setError("Gagal memuat pasaran.")); }, []);

  function toggleMarket(id: string) {
    setError("");
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_BATCH_MARKETS) { setError(`Maksimal ${MAX_BATCH_MARKETS} pasaran per batch scan.`); return current; }
      return [...current, id];
    });
  }
  function pilihSemua() { setError(""); const ids = filtered.map((market) => market.id).slice(0, MAX_BATCH_MARKETS); setSelected(ids); if (filtered.length > MAX_BATCH_MARKETS) setError(`Pilih Semua dibatasi ${MAX_BATCH_MARKETS} pasaran pertama.`); }
  function kosongkan() { setError(""); setSelected([]); }
  function changeMode(value: ScanMode) { setScanMode(value); if (!isShioMode(value) && digitCount > 9) setDigitCount(9); }

  async function runBatch() {
    setLoading(true); setError(""); setResult(null); setCopied(false);
    try {
      if (selected.length > MAX_BATCH_MARKETS) { setError(`Maksimal ${MAX_BATCH_MARKETS} pasaran per batch scan.`); return; }
      const safeRounds = clampTextNumber(rounds, 14, 1, 100);
      const safeDigit = Math.max(1, Math.min(isShioMode(scanMode) ? 12 : 9, digitCount));
      setRounds(String(safeRounds)); setDigitCount(safeDigit);
      const title = outputTitle(scanMode, targetPos, target2D, safeDigit);
      const res = await fetch("/api/batch-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketIds: selected, L: safeRounds, scanMode, targetPos, target2D, digitCount: safeDigit, outputTitle: title }) });
      const data = await res.json();
      if (data.error) setError(data.error); else setResult(data);
    } catch { setError("Batch scan gagal."); }
    finally { setLoading(false); }
  }

  async function copyOutput() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.copyText); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }
    catch { setError("Gagal copy output."); }
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}><div style={styles.kicker}>Scan Batch Publik</div><h1 style={styles.title}>Batch Scan</h1><p style={styles.sub}>Pilih banyak pasaran, scan sekali, output langsung siap copy.</p></header>

      <section style={styles.panel}>
        <div style={styles.rowTwo}>
          <div style={styles.field}><label style={styles.label}>Data Uji</label><input style={styles.input} inputMode="numeric" value={rounds} onChange={(e) => setRounds(cleanDigits(e.target.value, 3))} /></div>
          <div style={styles.field}><label style={styles.label}>Jenis</label><select style={styles.select} value={scanMode} onChange={(e) => changeMode(e.target.value as ScanMode)}>{ANALYSIS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        </div>
        <div style={styles.rowTwo}>
          <div style={styles.field}><label style={styles.label}>Target</label>{isPositionMode(scanMode) ? <select style={styles.select} value={targetPos} onChange={(e) => setTargetPos(e.target.value as Posisi)}>{POS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select> : <select style={styles.select} value={target2D} onChange={(e) => setTarget2D(e.target.value as Target2D)}>{TARGET_2D_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>}</div>
          <div style={styles.field}><label style={styles.label}>{isOffMode(scanMode) ? (isShioMode(scanMode) ? "Jumlah OFF Shio" : "Jumlah OFF") : (isShioMode(scanMode) ? "Jumlah Shio" : "Jumlah Digit")}</label><select style={styles.select} value={digitCount} onChange={(e) => setDigitCount(Number(e.target.value))}>{DIGIT_OPTIONS.filter((value) => isShioMode(scanMode) || value <= 9).map((value) => <option key={value} value={value}>{value} {isShioMode(scanMode) ? "shio" : "digit"}</option>)}</select></div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.tools}><button style={styles.smallBtn} type="button" onClick={pilihSemua}>Pilih Semua</button><button style={styles.smallBtn} type="button" onClick={kosongkan}>Kosongkan</button><span style={{ ...styles.smallBtn, marginLeft: "auto" }}>{selected.length}/{MAX_BATCH_MARKETS} dipilih</span></div>
        <input style={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari pasaran..." />
        <div style={styles.grid}>{filtered.map((market) => { const active = selected.includes(market.id); return <button key={market.id} type="button" onClick={() => toggleMarket(market.id)} style={{ minHeight: 72, borderRadius: 999, border: active ? "1px solid rgba(224,179,65,.72)" : "1px solid rgba(255,255,255,.10)", background: active ? "linear-gradient(180deg, rgba(224,179,65,.20), rgba(22,27,34,.96))" : "linear-gradient(180deg, rgba(255,255,255,.045), rgba(22,27,34,.88))", color: active ? "#fff2c6" : "#e9eef5", boxShadow: active ? "0 0 0 1px rgba(224,179,65,.12), inset 0 1px 0 rgba(255,255,255,.05)" : "inset 0 1px 0 rgba(255,255,255,.04)", padding: "10px 8px", fontSize: 13, fontWeight: 950, textAlign: "center", position: "relative" }}>{active && <span style={{ position: "absolute", right: 12, top: 8, color: "#e0b341", fontSize: 13 }}>✓</span>}{marketTitle(market)}</button>; })}</div>
        <p style={styles.notice}>Batas aman: maksimal {MAX_BATCH_MARKETS} pasaran per batch scan.</p>
        <button style={styles.run} type="button" onClick={runBatch} disabled={loading || selected.length === 0}>{loading ? "Sedang batch scan..." : "Batch Scan"}</button>
        {error && <div style={styles.error}>{error}</div>}
      </section>

      {result && <section style={styles.panel}><p style={styles.meta}>{result.results.length} pasaran · stop scan otomatis 1</p><pre style={styles.output}>{result.copyText}</pre><button style={styles.copy} type="button" onClick={copyOutput}>{copied ? "Tersalin" : "Copy Output"}</button></section>}

      <BottomNav />
    </main>
  );
}
