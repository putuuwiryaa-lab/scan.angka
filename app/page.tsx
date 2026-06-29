"use client";

import { useEffect, useState } from "react";

type Market = { id: string; name: string | null };
type KolomStat = {
  kolom: string;
  hit: number;
  lemah: boolean;
  digitLive: number;
};
type EngineResult = {
  config: { patokanPos: string; patokanN: number; targetPos: string; L: number };
  jumlahData: number;
  jumlahBacktest: number;
  kolom: KolomStat[];
  deretLive: number[];
  patokanLiveDraw: string;
  angkaKuat: number[];
  angkaMati: number[];
};

const POSISI: [string, string][] = [
  ["A", "As"],
  ["C", "Cop"],
  ["K", "Kepala"],
  ["E", "Ekor"],
];
const LABEL: Record<string, string> = {
  A: "As",
  C: "Cop",
  K: "Kepala",
  E: "Ekor",
};

export default function Page() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [patokanPos, setPatokanPos] = useState("A");
  const [patokanN, setPatokanN] = useState(1);
  const [targetPos, setTargetPos] = useState("K");
  const [L, setL] = useState(15);

  const [result, setResult] = useState<EngineResult | null>(null);
  const [marketName, setMarketName] = useState("");
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

  async function hitung() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/acke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, patokanPos, patokanN, targetPos, L }),
      });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
      } else {
        setResult(d.result);
        setMarketName(d.market ?? "");
      }
    } catch {
      setError("Gagal menghitung. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>Racik ACKE</h1>
        <p>Cari kolom mati As / Cop / Kepala / Ekor dari data keluaran.</p>
      </header>

      <div className="panel">
        <div className="field">
          <label>Pasaran</label>
          <select value={marketId} onChange={(e) => setMarketId(e.target.value)}>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.id}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Patokan</label>
          <div className="row two">
            <select
              value={patokanPos}
              onChange={(e) => setPatokanPos(e.target.value)}
            >
              {POSISI.map(([v, t]) => (
                <option key={v} value={v}>
                  {t} ({v})
                </option>
              ))}
            </select>
            <select
              value={patokanN}
              onChange={(e) => setPatokanN(Number(e.target.value))}
            >
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {patokanPos}
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Target & jumlah data</label>
          <div className="row two">
            <select
              value={targetPos}
              onChange={(e) => setTargetPos(e.target.value)}
            >
              {POSISI.map(([v, t]) => (
                <option key={v} value={v}>
                  {t} ({v})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={100}
              value={L}
              onChange={(e) => setL(Number(e.target.value))}
            />
          </div>
        </div>

        <button className="run" onClick={hitung} disabled={loading || !marketId}>
          {loading ? "Menghitung..." : "Hitung"}
        </button>

        {error && <div className="err">{error}</div>}
      </div>

      {result && (
        <div className="panel">
          <p className="summary">
            <b>{marketName}</b> &middot; patokan{" "}
            <b>
              {result.config.patokanPos}
              {result.config.patokanN}
            </b>{" "}
            &rarr; target <b>{LABEL[result.config.targetPos]}</b> &middot;{" "}
            {result.jumlahBacktest} data &middot; deret dari{" "}
            <b>{result.patokanLiveDraw}</b>
          </p>

          <div className="grid">
            {result.kolom.map((k) => (
              <div
                key={k.kolom}
                className={`cell ${k.lemah ? "mati" : "kuat"}`}
              >
                <span className="col">{k.kolom}</span>
                <span className="dig">{k.digitLive}</span>
                <span className="hits">{k.hit}x</span>
              </div>
            ))}
          </div>

          <div className="verdict">
            <div className="box mati">
              <span className="k">Mati {LABEL[result.config.targetPos]}</span>
              <div className="nums">
                {result.angkaMati.length
                  ? result.angkaMati.join(" ")
                  : "(tidak ada)"}
              </div>
            </div>
            <div className="box kuat">
              <span className="k">Kuat {LABEL[result.config.targetPos]}</span>
              <div className="nums">{result.angkaKuat.join(" ")}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
