"use client";

import { useEffect, useState } from "react";

type Market = { id: string; name: string | null };
type ScanItem = { targetPos: string; formula: string; code: string; angkaHidup: number[]; activeColumns: string; jumlahHidup: number };
type ScanResult = { config: { L: number; targetPos: string; digitCount: number; stopScan: number }; totalChecked: number; totalMatched: number; items: ScanItem[] };

const TREK: [string, string][] = [["A", "AS"], ["C", "COP"], ["K", "KPL"], ["E", "EKR"]];
const LABEL: Record<string, string> = { A: "AS", C: "COP", K: "KPL", E: "EKR" };

export default function Page() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [rounds, setRounds] = useState(15);
  const [targetPos, setTargetPos] = useState("K");
  const [digitCount, setDigitCount] = useState(3);
  const [stopScan, setStopScan] = useState(3);
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setError(d.error);
        setMarkets(d.markets ?? []);
        if (d.markets?.length) setMarketId(d.markets[0].id);
      })
      .catch(() => setError("Gagal memuat daftar pasaran."));
  }, []);

  async function mulaiScan() {
    setLoading(true);
    setError("");
    setResult(null);
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
        <div className="field">
          <label>Pilih Pasaran</label>
          <select value={marketId} onChange={(e) => setMarketId(e.target.value)}>
            {markets.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.id}</option>)}
          </select>
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
        <div className="panel">
          <p className="summary"><b>{marketName}</b> &middot; trek <b>{LABEL[result.config.targetPos]}</b> &middot; {result.config.digitCount} digit &middot; cek {result.totalChecked} rumus</p>
          <div className="scan-list">
            {result.items.length === 0 && <div className="scan-empty">Tidak ada trek lolos.</div>}
            {result.items.map((item, index) => (
              <div className="scan-item" key={`${item.targetPos}-${item.formula}-${index}`}>
                <div className="scan-top"><span className="scan-no">#{index + 1}</span><span className="scan-formula">{item.formula}</span><span className="scan-target">{LABEL[item.targetPos]}</span></div>
                <div className="scan-body"><div><span className="scan-label">Trek</span><b className="live-num">{item.angkaHidup.join(" ")}</b></div><div><span className="scan-label">Kolom Aktif</span><b>{item.activeColumns || "-"}</b></div></div>
                <div className="scan-code">{item.code}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
