"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type ScanMode = "posisi" | "ai_2d_belakang" | "bbfs_2d_belakang";
type TrekChoice = "A" | "C" | "K" | "E" | "ai_2d_belakang" | "bbfs_2d_belakang";
type Market = { id: string; name: string | null; latestResult?: string | null };
type BatchResult = { title: string; copyText: string; results: { id: string; name: string; digits: string }[] };

const TREK_OPTIONS: { value: TrekChoice; label: string }[] = [
  { value: "A", label: "As" },
  { value: "C", label: "Cop" },
  { value: "K", label: "Kepala" },
  { value: "E", label: "Ekor" },
  { value: "ai_2d_belakang", label: "AI 2D Belakang" },
  { value: "bbfs_2d_belakang", label: "BBFS 2D Belakang" },
];
const DIGIT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function marketTitle(market: Market) {
  return (market.name ?? market.id).toLowerCase();
}

function modeFromTrek(value: TrekChoice): { scanMode: ScanMode; targetPos: string } {
  if (value === "A" || value === "C" || value === "K" || value === "E") return { scanMode: "posisi", targetPos: value };
  return { scanMode: value, targetPos: "K" };
}

function outputTitleFromTrek(value: TrekChoice, digitCount: number) {
  const label: Record<TrekChoice, string> = {
    A: "As",
    C: "Cop",
    K: "Kepala",
    E: "Ekor",
    ai_2d_belakang: "AI",
    bbfs_2d_belakang: "BBFS",
  };
  if (value === "ai_2d_belakang" || value === "bbfs_2d_belakang") return `${label[value]} ${digitCount}D Belakang`;
  return `${label[value]} ${digitCount}D`;
}

function cleanDigits(value: string, maxLength = 3) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function clampTextNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 820, margin: "0 auto", padding: "18px 12px 70px" },
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
};

export default function AdminPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [rounds, setRounds] = useState("14");
  const [trek, setTrek] = useState<TrekChoice>("bbfs_2d_belakang");
  const [digitCount, setDigitCount] = useState(7);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return markets;
    return markets.filter((market) => marketTitle(market).toLowerCase().includes(needle));
  }, [markets, query]);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setError(d.error);
        setMarkets(d.markets ?? []);
      })
      .catch(() => setError("Gagal memuat pasaran."));
  }, []);

  function toggleMarket(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function pilihSemua() {
    setSelected(filtered.map((market) => market.id));
  }

  function kosongkan() {
    setSelected([]);
  }

  async function runBatch() {
    setLoading(true);
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const safeRounds = clampTextNumber(rounds, 14, 1, 100);
      setRounds(String(safeRounds));
      const { scanMode, targetPos } = modeFromTrek(trek);
      const outputTitle = outputTitleFromTrek(trek, digitCount);
      const res = await fetch("/api/admin/batch-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketIds: selected, L: safeRounds, scanMode, targetPos, digitCount, outputTitle }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
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
    <main style={styles.page}>
      <header style={styles.header}>
        <div style={styles.kicker}>Admin</div>
        <h1 style={styles.title}>Batch Scan</h1>
        <p style={styles.sub}>Pilih banyak pasaran, scan sekali, output langsung siap copy.</p>
      </header>

      <section style={styles.panel}>
        <div style={styles.rowTwo}>
          <div style={styles.field}>
            <label style={styles.label}>Data Uji</label>
            <input style={styles.input} inputMode="numeric" value={rounds} onChange={(e) => setRounds(cleanDigits(e.target.value, 3))} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Jenis Trek</label>
            <select style={styles.select} value={trek} onChange={(e) => setTrek(e.target.value as TrekChoice)}>
              {TREK_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Jumlah Digit</label>
          <select style={styles.select} value={digitCount} onChange={(e) => setDigitCount(Number(e.target.value))}>
            {DIGIT_OPTIONS.map((value) => <option key={value} value={value}>{value} digit</option>)}
          </select>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.tools}>
          <button style={styles.smallBtn} type="button" onClick={pilihSemua}>Pilih Semua</button>
          <button style={styles.smallBtn} type="button" onClick={kosongkan}>Kosongkan</button>
          <span style={{ ...styles.smallBtn, marginLeft: "auto" }}>{selected.length} dipilih</span>
        </div>
        <input style={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari pasaran..." />
        <div style={styles.grid}>
          {filtered.map((market) => {
            const active = selected.includes(market.id);
            return (
              <button
                key={market.id}
                type="button"
                onClick={() => toggleMarket(market.id)}
                style={{
                  minHeight: 72,
                  borderRadius: 999,
                  border: active ? "1px solid rgba(224,179,65,.72)" : "1px solid rgba(255,255,255,.10)",
                  background: active ? "linear-gradient(180deg, rgba(224,179,65,.20), rgba(22,27,34,.96))" : "linear-gradient(180deg, rgba(255,255,255,.045), rgba(22,27,34,.88))",
                  color: active ? "#fff2c6" : "#e9eef5",
                  boxShadow: active ? "0 0 0 1px rgba(224,179,65,.12), inset 0 1px 0 rgba(255,255,255,.05)" : "inset 0 1px 0 rgba(255,255,255,.04)",
                  padding: "10px 8px",
                  fontSize: 13,
                  fontWeight: 950,
                  textAlign: "center",
                  position: "relative",
                }}
              >
                {active && <span style={{ position: "absolute", right: 12, top: 8, color: "#e0b341", fontSize: 13 }}>✓</span>}
                {marketTitle(market)}
              </button>
            );
          })}
        </div>
        <button style={styles.run} type="button" onClick={runBatch} disabled={loading || selected.length === 0}>{loading ? "Sedang batch scan..." : "Batch Scan"}</button>
        {error && <div style={styles.error}>{error}</div>}
      </section>

      {result && (
        <section style={styles.panel}>
          <p style={styles.meta}>{result.results.length} pasaran · stop scan otomatis 1</p>
          <pre style={styles.output}>{result.copyText}</pre>
          <button style={styles.copy} type="button" onClick={copyOutput}>{copied ? "Tersalin" : "Copy Output"}</button>
        </section>
      )}
    </main>
  );
}
