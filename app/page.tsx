"use client";

import { useEffect, useMemo, useState } from "react";

type Market = { id: string; name: string | null };
type ScanRow = { patokanDraw: string; targetDraw: string; deret: number[] };
type ScanItem = {
  targetPos: string;
  formula: string;
  angkaHidup: number[];
  activeColumns: string;
  result: { rows: ScanRow[]; patokanLiveDraw: string; deretLive: number[] };
};
type ScanResult = {
  config: { L: number; targetPos: string; digitCount: number; stopScan: number };
  totalChecked: number;
  totalMatched: number;
  items: ScanItem[];
};

const TREK: [string, string][] = [["A", "As"], ["C", "Cop"], ["K", "Kepala"], ["E", "Ekor"]];
const LABEL: Record<string, string> = { A: "As", C: "Cop", K: "Kepala", E: "Ekor" };
const NAME: Record<string, string> = { A: "as", C: "cop", K: "kepala", E: "ekor" };
const COLS = "ABCDEFGHIJ";

function pickColumns(activeColumns: string, deret: number[]) {
  return activeColumns
    .split("")
    .map((c) => deret[COLS.indexOf(c)])
    .filter((n) => Number.isFinite(n))
    .join("");
}

function marketTitle(market: Market) {
  return market.name ?? market.id;
}

function rowResult(item: ScanItem, row: ScanRow) {
  return pickColumns(item.activeColumns, row.deret);
}

function predictionResult(item: ScanItem) {
  return pickColumns(item.activeColumns, item.result.deretLive);
}

export default function Page() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [marketQuery, setMarketQuery] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const [rounds, setRounds] = useState(15);
  const [targetPos, setTargetPos] = useState("K");
  const [digitCount, setDigitCount] = useState(3);
  const [stopScan, setStopScan] = useState(3);
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [viewItem, setViewItem] = useState<ScanItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredMarkets = useMemo(() => {
    const query = marketQuery.trim().toLowerCase();
    if (!query) return markets.slice(0, 30);
    return markets.filter((m) => marketTitle(m).toLowerCase().includes(query)).slice(0, 30);
  }, [markets, marketQuery]);
  const viewRows = useMemo(() => viewItem?.result.rows ?? [], [viewItem]);
  const nextPrediction = viewItem ? predictionResult(viewItem) : "";

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setError(d.error);
        const list: Market[] = d.markets ?? [];
        setMarkets(list);
        if (list.length) {
          setMarketId(list[0].id);
          setMarketQuery(marketTitle(list[0]));
        }
      })
      .catch(() => setError("Gagal memuat daftar pasaran."));
  }, []);

  function pilihMarket(market: Market) {
    setMarketId(market.id);
    setMarketQuery(marketTitle(market));
    setMarketOpen(false);
  }

  async function mulaiScan() {
    setLoading(true);
    setError("");
    setResult(null);
    setViewItem(null);
    try {
      const safeRounds = Math.max(1, Math.min(100, Number(rounds) || 15));
      const safeDigit = Math.max(1, Math.min(10, Number(digitCount) || 3));
      const safeStop = Math.max(1, Math.min(200, Number(stopScan) || 3));
      setRounds(safeRounds);
      setDigitCount(safeDigit);
      setStopScan(safeStop);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, L: safeRounds, targetPos, digitCount: safeDigit, stopScan: safeStop }),
      });
      const d = await res.json();
      if (d.error) setError(d.error);
      else {
        setMarketName(d.market ?? "");
        setResult(d.result);
      }
    } catch {
      setError("Scan gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>Scan Angka</h1>
        <p>Scanner otomatis rumus ACKE dari data pasaran.</p>
      </header>

      <div className="panel">
        <div className="field market-field">
          <label>Pilih Pasaran</label>
          <input
            className="market-search"
            value={marketQuery}
            onChange={(e) => {
              setMarketQuery(e.target.value);
              setMarketOpen(true);
            }}
            onFocus={() => setMarketOpen(true)}
            placeholder="Cari pasaran..."
          />
          {marketOpen && (
            <div className="market-menu">
              {filteredMarkets.length === 0 && <div className="market-empty">Pasaran tidak ditemukan</div>}
              {filteredMarkets.map((m) => (
                <button key={m.id} type="button" className={m.id === marketId ? "market-option active" : "market-option"} onClick={() => pilihMarket(m)}>
                  <span>{marketTitle(m)}</span>
                  {m.id === marketId && <b>✓</b>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="row two">
          <div className="field">
            <label>Putaran / Data</label>
            <input type="number" min={1} max={100} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Jenis Trek</label>
            <select value={targetPos} onChange={(e) => setTargetPos(e.target.value)}>
              {TREK.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </div>
        </div>

        <div className="row two">
          <div className="field">
            <label>Jumlah Digit</label>
            <select value={digitCount} onChange={(e) => setDigitCount(Number(e.target.value))}>
              {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n} digit</option>)}
            </select>
          </div>
          <div className="field">
            <label>Stop Scan</label>
            <input type="number" min={1} max={200} value={stopScan} onChange={(e) => setStopScan(Number(e.target.value))} />
          </div>
        </div>

        <button className="run" onClick={mulaiScan} disabled={loading || !marketId}>{loading ? "Scanning..." : "Mulai Scan"}</button>
        {error && <div className="err">{error}</div>}
      </div>

      {result && (
        <div className="panel result-panel">
          <p className="summary"><b>{marketName}</b> &middot; <b>{LABEL[result.config.targetPos]}</b> &middot; {result.config.digitCount} digit &middot; {result.totalMatched} hasil</p>
          <div className="scan-list">
            {result.items.length === 0 && <div className="scan-empty">Tidak ada trek lolos.</div>}
            {result.items.map((item, index) => (
              <div className="scan-item clean" key={`${item.targetPos}-${item.formula}-${index}`}>
                <div className="scan-top">
                  <span className="scan-no">#{index + 1}</span>
                  <span className="scan-formula">{item.formula}</span>
                  <span className="scan-target">{LABEL[item.targetPos]}</span>
                </div>
                <div className="trek-line">{item.angkaHidup.join(" ")}</div>
                <button className="view-btn" type="button" onClick={() => setViewItem(item)}>View</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewItem && (
        <div className="sheet-bg" onClick={() => setViewItem(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <div>
                <b>Rumus {NAME[viewItem.targetPos]} ({viewItem.targetPos.toLowerCase()}) {viewItem.angkaHidup.length} Digit</b>
                <span>KEY : {viewItem.formula.toLowerCase()}</span>
              </div>
              <button type="button" onClick={() => setViewItem(null)}>×</button>
            </div>
            <div className="trek-detail">
              {viewRows.map((row, idx) => (
                <div className="trek-row" key={`${row.patokanDraw}-${idx}`}>
                  <span>{row.patokanDraw}</span>
                  <b>{rowResult(viewItem, row)}</b>
                  <em>{NAME[viewItem.targetPos]}</em>
                </div>
              ))}
              <div className="trek-row pending">
                <span>{viewItem.result.patokanLiveDraw}</span>
                <b>{nextPrediction}</b>
                <em>??</em>
              </div>
              <div className="trek-footer"><b>{NAME[viewItem.targetPos]}</b> : {nextPrediction}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
