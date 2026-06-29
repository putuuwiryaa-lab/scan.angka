"use client";

import { useEffect, useState } from "react";

type Market = { id: string; name: string | null };
type ScanItem = {
  targetPos: string;
  formula: string;
  code: string;
  angkaMati: number[];
  angkaKuat: number[];
  activeColumns: string;
  jumlahMati: number;
};
type ScanResult = {
  config: {
    L: number;
    targetPos: string;
    minMati: number;
    stopScan: number;
  };
  totalChecked: number;
  totalMatched: number;
  items: ScanItem[];
};

const TREK: [string, string][] = [
  ["A", "AS"],
  ["C", "COP"],
  ["K", "KPL"],
  ["E", "EKR"],
];

const LABEL: Record<string, string> = {
  A: "AS",
  C: "COP",
  K: "KPL",
  E: "EKR",
};

export default function Page() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [rounds, setRounds] = useState(15);
  const [targetPos, setTargetPos] = useState("K");
  const [digitCount, setDigitCount] = useState(1);
  const [stopScan, setStopScan] = useState(3);
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
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
      const safeDigit = Math.max(1, Math.min(4, Number(digitCount) || 1));
      const safeStop = Math.max(1, Math.min(200, Number(stopScan) || 3));

      setRounds(safeRounds);
      setDigitCount(safeDigit);
      setStopScan(safeStop);

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          L: safeRounds,
          targetPos,
          minMati: safeDigit,
          stopScan: safeStop,
        }),
      });
      const d = await res.json();

      if (d.error) {
        setError(d.error);
      } else {
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
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.id}
              </option>
            ))}
          </select>
        </div>

        <div className="row two">
          <div className="field">
            <label>Putaran / Data</label>
            <input
              type="number"
              min={1}
              max={100}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Jenis Trek</label>
            <select value={targetPos} onChange={(e) => setTargetPos(e.target.value)}>
              {TREK.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row two">
          <div className="field">
            <label>Jumlah Digit</label>
            <select value={digitCount} onChange={(e) => setDigitCount(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} digit
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Stop Scan</label>
            <input
              type="number"
              min={1}
              max={200}
              value={stopScan}
              onChange={(e) => setStopScan(Number(e.target.value))}
            />
          </div>
        </div>

        <button className="run" onClick={mulaiScan} disabled={loading || !marketId}>
          {loading ? "Scanning..." : "Mulai Scan"}
        </button>

        {error && <div className="err">{error}</div>}
      </div>

      {result && (
        <div className="panel">
          <p className="summary">
            <b>{marketName}</b> &middot; target <b>{LABEL[result.config.targetPos]}</b> &middot; L{result.config.L} &middot; cek {result.totalChecked} rumus
          </p>

          <div className="scan-list">
            {result.items.length === 0 && (
              <div className="scan-empty">Tidak ada rumus lolos.</div>
            )}

            {result.items.map((item, index) => (
              <div className="scan-item" key={`${item.targetPos}-${item.formula}-${index}`}>
                <div className="scan-top">
                  <span className="scan-no">#{index + 1}</span>
                  <span className="scan-formula">{item.formula}</span>
                  <span className="scan-target">{LABEL[item.targetPos]}</span>
                </div>
                <div className="scan-body">
                  <div>
                    <span className="scan-label">Mati</span>
                    <b className="dead-num">{item.angkaMati.join(" ")}</b>
                  </div>
                  <div>
                    <span className="scan-label">Kolom Aktif</span>
                    <b>{item.activeColumns || "-"}</b>
                  </div>
                </div>
                <div className="scan-code">{item.code}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
