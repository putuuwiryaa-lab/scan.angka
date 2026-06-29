"use client";

import { useEffect, useMemo, useState } from "react";

type Market = { id: string; name: string | null; latestResult?: string | null; updatedAt?: string | null };
type ScanRow = { displayDraw: string; patokanDraw: string; targetDraw: string; targetDigit: number; deret: number[] };
type ScanItem = {
  targetPos: string;
  formula: string;
  angkaHidup: number[];
  activeColumns: string;
  result: { rows: ScanRow[]; patokanLiveDraw: string; latestDraw: string; deretLive: number[] };
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
const SHORT: Record<string, string> = { A: "a", C: "c", K: "k", E: "e" };
const COLS = "ABCDEFGHIJ";
const DIGIT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function pickColumns(activeColumns: string, deret: number[]) {
  return activeColumns
    .split("")
    .map((c) => deret[COLS.indexOf(c)])
    .filter((n) => Number.isFinite(n));
}

function marketTitle(market: Market) {
  return market.name ?? market.id;
}

function isSingapore(market: Market) {
  const text = `${market.id} ${market.name ?? ""}`.toLowerCase();
  return text.includes("singapore") || text.includes("sgp");
}

function cleanDigits(value: string, maxLength = 3) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function clampTextNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function formatSyncTime(value: string | null) {
  if (!value) return "Sinkron data belum tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sinkron data belum tersedia";
  return `Terakhir sinkron data: ${date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function rowResultDigits(item: ScanItem, row: ScanRow) {
  return pickColumns(item.activeColumns, row.deret).map((digit) => ({
    digit,
    hit: digit === row.targetDigit,
  }));
}

function rowResultText(item: ScanItem, row: ScanRow) {
  return rowResultDigits(item, row).map(({ digit }) => digit).join("");
}

function predictionResult(item: ScanItem) {
  return pickColumns(item.activeColumns, item.result.deretLive).join("");
}

function buildCopyText(item: ScanItem, rows: ScanRow[], nextPrediction: string) {
  const short = SHORT[item.targetPos];
  const header = [`Detail Trek ${NAME[item.targetPos]} (${short})`, `Rumus : ${item.formula.toLowerCase()}`];
  const history = rows.map((row) => `${row.displayDraw} ➜ ${rowResultText(item, row)} ${short}`);
  const next = `${item.result.latestDraw} ➜ ${nextPrediction} ??`;
  return [...header, "", ...history, next].join("\n");
}

export default function Page() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [marketQuery, setMarketQuery] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const [rounds, setRounds] = useState("15");
  const [targetPos, setTargetPos] = useState("K");
  const [trekOpen, setTrekOpen] = useState(false);
  const [digitCount, setDigitCount] = useState(7);
  const [digitOpen, setDigitOpen] = useState(false);
  const [stopScan, setStopScan] = useState("3");
  const [syncUpdatedAt, setSyncUpdatedAt] = useState<string | null>(null);
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [viewItem, setViewItem] = useState<ScanItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedMarket = useMemo(
    () => markets.find((m) => m.id === marketId) ?? null,
    [markets, marketId]
  );
  const filteredMarkets = useMemo(() => {
    const query = marketQuery.trim().toLowerCase();
    if (!query) return markets.slice(0, 30);
    return markets.filter((m) => marketTitle(m).toLowerCase().includes(query)).slice(0, 30);
  }, [markets, marketQuery]);
  const syncText = useMemo(() => formatSyncTime(syncUpdatedAt), [syncUpdatedAt]);
  const viewRows = useMemo(() => viewItem?.result.rows ?? [], [viewItem]);
  const nextPrediction = viewItem ? predictionResult(viewItem) : "";

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setError(d.error);
        const list: Market[] = d.markets ?? [];
        setMarkets(list);
        setSyncUpdatedAt(d.syncUpdatedAt ?? null);
        const defaultMarket = list.find(isSingapore) ?? list[0];
        if (defaultMarket) setMarketId(defaultMarket.id);
      })
      .catch(() => setError("Gagal memuat daftar pasaran."));
  }, []);

  function bukaMarket() {
    if (marketOpen) {
      setMarketOpen(false);
      return;
    }
    setMarketQuery("");
    setTrekOpen(false);
    setDigitOpen(false);
    setMarketOpen(true);
  }

  function pilihMarket(market: Market) {
    setMarketId(market.id);
    setMarketQuery("");
    setMarketOpen(false);
  }

  function toggleTrek() {
    setMarketOpen(false);
    setDigitOpen(false);
    setTrekOpen((open) => !open);
  }

  function pilihTrek(value: string) {
    setTargetPos(value);
    setTrekOpen(false);
  }

  function toggleDigit() {
    setMarketOpen(false);
    setTrekOpen(false);
    setDigitOpen((open) => !open);
  }

  function pilihDigit(value: number) {
    setDigitCount(value);
    setDigitOpen(false);
  }

  async function copyTrek() {
    if (!viewItem) return;
    const text = buildCopyText(viewItem, viewRows, nextPrediction);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Gagal salin trek.");
    }
  }

  async function mulaiScan() {
    setLoading(true);
    setError("");
    setResult(null);
    setViewItem(null);
    setCopied(false);
    try {
      const safeRounds = clampTextNumber(rounds, 15, 1, 100);
      const safeDigit = Math.max(1, Math.min(9, Number(digitCount) || 7));
      const safeStop = clampTextNumber(stopScan, 3, 1, 200);
      setRounds(String(safeRounds));
      setDigitCount(safeDigit);
      setStopScan(String(safeStop));
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
      <header className="hero">
        <div className="hero-kicker">Scanner Rumus Otomatis</div>
        <h1>Scan Angka</h1>
        <p>Cari trek angka dari riwayat result terbaru.</p>
      </header>
      <div className="sync-status">{syncText}</div>

      <div className="panel">
        <div className="field market-field">
          <label>Pasaran</label>
          <button className="market-select" type="button" onClick={bukaMarket}>
            <span className="select-badge" />
            <b>{selectedMarket ? marketTitle(selectedMarket) : "Pilih pasaran"}</b>
            <span className="latest-result">{selectedMarket?.latestResult ?? "----"}</span>
            <span className="select-arrow">{marketOpen ? "⌃" : "⌄"}</span>
          </button>
          {marketOpen && (
            <div className="market-menu">
              <div className="market-menu-top">
                <input
                  className="market-search"
                  value={marketQuery}
                  onChange={(e) => setMarketQuery(e.target.value)}
                  placeholder="Cari pasaran..."
                  autoFocus
                />
                <button type="button" onClick={() => setMarketOpen(false)}>×</button>
              </div>
              {filteredMarkets.length === 0 && <div className="market-empty">Pasaran tidak ditemukan</div>}
              {filteredMarkets.map((m) => (
                <button key={m.id} type="button" className={m.id === marketId ? "market-option active" : "market-option"} onClick={() => pilihMarket(m)}>
                  <span className="option-badge" />
                  <span className="option-label">{marketTitle(m)}</span>
                  {m.latestResult && <em>{m.latestResult}</em>}
                  {m.id === marketId && <b>✓</b>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="row two">
          <div className="field">
            <label>Data Uji</label>
            <input
              inputMode="numeric"
              value={rounds}
              onChange={(e) => setRounds(cleanDigits(e.target.value, 3))}
              onBlur={() => setRounds(String(clampTextNumber(rounds, 15, 1, 100)))}
            />
          </div>
          <div className="field trek-field">
            <label>Posisi Trek</label>
            <button className="trek-select" type="button" onClick={toggleTrek}>
              <span className="select-badge" />
              <b>{LABEL[targetPos]}</b>
              <span className="select-arrow">{trekOpen ? "⌃" : "⌄"}</span>
            </button>
            {trekOpen && (
              <div className="trek-menu">
                {TREK.map(([value, text]) => (
                  <button key={value} type="button" className={value === targetPos ? "trek-option active" : "trek-option"} onClick={() => pilihTrek(value)}>
                    <span className="option-badge" />
                    <span className="option-label">{text}</span>
                    {value === targetPos && <b>✓</b>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="row two">
          <div className="field digit-field">
            <label>Jumlah Digit Trek</label>
            <button className="digit-select" type="button" onClick={toggleDigit}>
              <span className="select-badge" />
              <b>{digitCount} digit</b>
              <span className="select-arrow">{digitOpen ? "⌃" : "⌄"}</span>
            </button>
            {digitOpen && (
              <div className="digit-menu">
                {DIGIT_OPTIONS.map((value) => (
                  <button key={value} type="button" className={value === digitCount ? "digit-option active" : "digit-option"} onClick={() => pilihDigit(value)}>
                    <span className="option-badge" />
                    <span className="option-label">{value} digit</span>
                    {value === digitCount && <b>✓</b>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label>Batas Hasil</label>
            <input
              inputMode="numeric"
              value={stopScan}
              onChange={(e) => setStopScan(cleanDigits(e.target.value, 3))}
              onBlur={() => setStopScan(String(clampTextNumber(stopScan, 3, 1, 200)))}
            />
          </div>
        </div>

        <button className="run" onClick={mulaiScan} disabled={loading || !marketId}>{loading ? "Sedang scan..." : "Scan Sekarang"}</button>
        {error && <div className="err">{error}</div>}
      </div>

      {result && (
        <div className="panel result-panel">
          <p className="summary"><b>{marketName}</b> &middot; <b>{LABEL[result.config.targetPos]}</b> &middot; {result.config.digitCount} digit &middot; {result.totalMatched} hasil</p>
          <div className="scan-list">
            {result.items.length === 0 && <div className="scan-empty">Belum ada trek yang cocok.</div>}
            {result.items.map((item, index) => (
              <div className="scan-item clean" key={`${item.targetPos}-${item.formula}-${index}`}>
                <div className="scan-top">
                  <span className="scan-no">#{index + 1}</span>
                  <span className="scan-formula">{item.formula}</span>
                  <span className="scan-target">{LABEL[item.targetPos]}</span>
                </div>
                <div className="trek-line">
                  {item.angkaHidup.map((digit, digitIndex) => (
                    <span key={`${digit}-${digitIndex}`}>{digit}</span>
                  ))}
                </div>
                <button className="view-btn" type="button" onClick={() => { setCopied(false); setViewItem(item); }}>Lihat Trek</button>
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
                <b>Detail Trek {NAME[viewItem.targetPos]} ({SHORT[viewItem.targetPos]})</b>
                <span>Rumus : {viewItem.formula.toLowerCase()}</span>
              </div>
              <div className="sheet-actions">
                <button className="copy-btn" type="button" onClick={copyTrek}>{copied ? "Tersalin" : "Salin Trek"}</button>
                <button className="close-btn" type="button" onClick={() => setViewItem(null)}>×</button>
              </div>
            </div>
            <div className="trek-detail">
              {viewRows.map((row, idx) => (
                <div className="trek-row" key={`${row.displayDraw}-${idx}`}>
                  <span>{row.displayDraw}</span>
                  <i>➜</i>
                  <b className="row-digits">
                    {rowResultDigits(viewItem, row).map(({ digit, hit }, digitIndex) => (
                      <span key={`${digit}-${digitIndex}`} className={hit ? "hit-digit" : ""}>{digit}</span>
                    ))}
                  </b>
                  <em>{SHORT[viewItem.targetPos]}</em>
                </div>
              ))}
              <div className="trek-row pending">
                <span>{viewItem.result.latestDraw}</span>
                <i>➜</i>
                <b className="row-digits">
                  {nextPrediction.split("").map((digit, index) => <span key={`${digit}-${index}`}>{digit}</span>)}
                </b>
                <em>??</em>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
