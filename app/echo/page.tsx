"use client";

import { useState } from "react";
import BottomNav from "../bottom-nav";
import AppPromoBanner from "../shared/AppPromoBanner";
import { LABEL, TARGET_2D_LABEL, TARGET_3D_LABEL } from "../scan/constants";
import { analysisTitle, labelsFromValues } from "../scan/helpers";
import { useMarketPicker } from "../scan/hooks/useMarketPicker";
import { useScanDropdowns } from "../scan/hooks/useScanDropdowns";
import { is3DMode, isPositionMode, isShioMode } from "../shared/scan-utils";
import type { Market, Posisi, ScanMode, Target2D, Target3D } from "../scan/types";
import type { EchoFamily, EchoItem } from "../../lib/echo/types";
import EchoControlPanel from "./EchoControlPanel";
import { useEchoRunner } from "./useEchoRunner";

const FAMILY_LABEL: Record<EchoFamily, string> = {
  EL: "Echo Lokal",
  EX: "Echo Silang",
  ER: "Echo Rezim",
  EA: "Echo Area",
  EJ: "Echo Jumlah",
  ES: "Echo Shio",
};

function profileTitle(item: EchoItem) {
  const anchor = item.anchorPos ? ` ${LABEL[item.anchorPos]}` : "";
  return `${FAMILY_LABEL[item.family]}${anchor}`;
}

function copyText(item: EchoItem, marketName: string) {
  const digits = labelsFromValues(item.angkaHidup, item.scanMode).join(isShioMode(item.scanMode) ? "-" : "");
  const discovery = item.audit.windows.map((window) => `L${window.window} ${window.hit}/${window.total}`).join(" · ");
  return [
    `*${marketName.toUpperCase()} · ECHO ENGINE*`,
    `${analysisTitle(item.scanMode, item.targetPos, item.target2D, item.target3D)} · ${profileTitle(item)}`,
    `Output: ${digits}`,
    `Discovery: ${item.audit.discoveryWeightedAccuracy}%`,
    discovery,
    `Holdout: ${item.audit.holdoutHit}/${item.audit.holdoutTotal}`,
    `Recent: ${item.audit.recentHit}/${item.audit.recentTotal}`,
    `Keyakinan live: ${item.confidenceLevel} ${item.confidence}`,
    `Konsensus keluarga: ${item.familyAgreement}%`,
  ].join("\n");
}

async function copyResult(item: EchoItem, marketName: string) {
  const text = copyText(item, marketName);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

function EchoResultView({ item, marketName }: { item: EchoItem; marketName: string }) {
  return (
    <section className="echo-result-shell">
      <div className="panel echo-primary">
        <div className="echo-result-head">
          <div>
            <span className="echo-main-label">REKOMENDASI UTAMA</span>
            <h2>{profileTitle(item)}</h2>
            <code>{item.formula}</code>
          </div>
          <div className={`echo-confidence confidence-${item.confidenceLevel.toLowerCase()}`}>
            <b>{item.confidenceLevel}</b>
            <span>{item.confidence}</span>
          </div>
        </div>

        <p className="summary">
          <b>{marketName}</b> · {analysisTitle(item.scanMode, item.targetPos, item.target2D, item.target3D)}
        </p>
        <div className="compact-digits echo-main-digits">
          {labelsFromValues(item.angkaHidup, item.scanMode).map((digit, index) => <span key={`${digit}-${index}`}>{digit}</span>)}
        </div>
        <div className="echo-meta">
          <span>Skor {item.score}</span>
          <span>Holdout {item.audit.holdoutHit}/{item.audit.holdoutTotal}</span>
          <span>Recent {item.audit.recentHit}/{item.audit.recentTotal}</span>
          <span>Konsensus {item.familyAgreement}%</span>
        </div>
        <button className="run" type="button" onClick={() => copyResult(item, marketName)}>Salin Hasil</button>
      </div>

      <div className="panel">
        <p className="summary"><b>Prediksi Live</b></p>
        <div className="echo-info-grid">
          <div className="frequency-item"><b>{item.result.latestDraw}</b><span>Result terakhir</span></div>
          <div className="frequency-item"><b>{item.result.patokan}</b><span>Patokan Echo</span></div>
          <div className="frequency-item"><b>{item.activeColumns}</b><span>Kolom aktif</span></div>
          <div className="frequency-item"><b>{item.echo.regime}</b><span>Kondisi live</span></div>
          <div className="frequency-item"><b>{item.echo.effectiveNeighbors}</b><span>Echo efektif</span></div>
          <div className="frequency-item"><b>{item.echo.stability}%</b><span>Stabilitas analog</span></div>
        </div>
      </div>

      <div className="panel">
        <p className="summary"><b>Validasi Objektif</b></p>
        <div className="echo-info-grid">
          <div className="frequency-item"><b>{item.audit.discoveryWeightedAccuracy}%</b><span>Discovery gabungan</span></div>
          <div className="frequency-item"><b>{item.audit.holdoutRate}%</b><span>Holdout murni</span></div>
          <div className="frequency-item"><b>{item.audit.discoveryWindowStability}%</b><span>Stabilitas discovery</span></div>
          <div className="frequency-item"><b>L{item.audit.strongestWindow}</b><span>Window terkuat</span></div>
          <div className="frequency-item"><b>L{item.audit.weakestWindow}</b><span>Window terlemah</span></div>
          <div className="frequency-item"><b>{item.audit.longestMissStreak}</b><span>Miss terpanjang</span></div>
        </div>
      </div>

      <div className="panel">
        <p className="summary"><b>Discovery Multi-Window</b></p>
        <div className="echo-window-list">
          {item.audit.windows.map((window) => (
            <div className="frequency-item echo-window-row" key={window.window}>
              <b>L{window.window}</b>
              <span>{window.hit}/{window.total}</span>
              <strong>{window.rate}%</strong>
              <small>bobot {Math.round(window.weight * 100)}%</small>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <p className="summary"><b>Konsensus Antar-Keluarga</b></p>
        <div className="echo-consensus-row">
          <b>{item.familyAgreement}%</b>
          <span>Didukung oleh {item.consensusFamilies.map((family) => FAMILY_LABEL[family]).join(", ")}.</span>
        </div>
      </div>

      <div className="panel">
        <p className="summary"><b>Analog Historis Terdekat</b></p>
        <div className="echo-list">
          {item.result.neighbors.map((neighbor, index) => (
            <div className="frequency-item echo-list-row" key={`${neighbor.anchorIndex}-${index}`}>
              <b>{index + 1}</b>
              <span>{neighbor.anchorDraw} ➜ {neighbor.nextDraw}</span>
              <span>Δ{neighbor.movement > 0 ? "+" : ""}{neighbor.movement}</span>
              <small>{neighbor.distance.toFixed(3)}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <p className="summary"><b>Audit Walk-Forward</b></p>
        <div className="echo-list">
          {item.result.rows.map((row, index) => (
            <div className="frequency-item echo-audit-row" key={`${row.targetIndex}-${index}`}>
              <b>{index + 1}</b>
              <span>{row.displayDraw} ➜ {row.targetDraw}</span>
              <span>P{row.patokan}</span>
              <strong>{row.covered ? "✓" : "×"}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function EchoPage() {
  const {
    marketId,
    marketQuery,
    selectedMarket,
    filteredMarkets,
    syncText,
    marketError,
    setMarketQuery,
    selectMarket,
  } = useMarketPicker();
  const { isOpen, toggleDropdown, closeDropdown } = useScanDropdowns();
  const [scanMode, setScanMode] = useState<ScanMode>("ai_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [target3D, setTarget3D] = useState<Target3D>("belakang");
  const [digitCount, setDigitCount] = useState(4);
  const { marketName, result, loading, echoError, runEcho } = useEchoRunner();
  const targetText = isPositionMode(scanMode) ? LABEL[targetPos] : is3DMode(scanMode) ? TARGET_3D_LABEL[target3D] : TARGET_2D_LABEL[target2D];

  function chooseMarket(market: Market) {
    selectMarket(market);
    closeDropdown();
  }

  function chooseMode(value: ScanMode) {
    setScanMode(value);
    closeDropdown();
    if (!isShioMode(value) && digitCount > 9) setDigitCount(9);
    if ((value === "ai_3d" || value === "bbfs_3d") && digitCount < 7) setDigitCount(7);
    if (value === "off_3d" && digitCount > 3) setDigitCount(3);
  }

  function startEcho() {
    runEcho({
      marketId,
      scanMode,
      targetPos,
      target2D,
      target3D,
      digitCount,
      onDigitCountChange: setDigitCount,
      onBeforeRun: closeDropdown,
    });
  }

  const item = result?.items[0] ?? null;
  const resolvedMarketName = marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran";

  return (
    <div className="wrap">
      <style>{`
        .echo-audit-info { margin:2px 0 16px; padding:13px 14px; border:1px solid rgba(224,179,65,.24); border-radius:14px; background:rgba(224,179,65,.07); }
        .echo-audit-info > div { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .echo-audit-info b { color:#e9eef5; font-size:13px; }
        .echo-audit-info span { color:#e0b341; font-size:12px; font-weight:950; }
        .echo-audit-info p { margin:6px 0 0; color:#8b97a8; font-size:12px; line-height:1.5; }
        .echo-result-shell { display:grid; gap:12px; }
        .echo-primary { border-color:rgba(224,179,65,.32); background:linear-gradient(180deg,rgba(224,179,65,.08),rgba(17,24,35,.96)); }
        .echo-result-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
        .echo-result-head h2 { margin:5px 0 3px; font-size:20px; }
        .echo-result-head code { color:#8b97a8; font-size:11px; }
        .echo-main-label { color:#e0b341; font-size:10px; font-weight:950; letter-spacing:1.2px; }
        .echo-confidence { min-width:62px; display:grid; place-items:center; gap:2px; padding:9px; border-radius:13px; background:rgba(110,155,255,.1); }
        .echo-confidence b { font-size:10px; }
        .echo-confidence span { font-size:22px; font-weight:950; }
        .confidence-high { color:#e0b341; } .confidence-medium { color:#cfe0ff; } .confidence-low { color:#8b97a8; }
        .echo-main-digits { margin:13px 0; }
        .echo-meta { display:flex; flex-wrap:wrap; gap:7px; margin:9px 0 14px; }
        .echo-meta span { padding:5px 8px; border-radius:9px; background:rgba(110,155,255,.08); font-size:11px; color:#cfe0ff; }
        .echo-info-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .echo-window-list,.echo-list { display:grid; gap:8px; }
        .echo-window-row { display:grid; grid-template-columns:42px 1fr auto auto; align-items:center; gap:9px; }
        .echo-window-row strong { color:#e0b341; } .echo-window-row small { color:#8b97a8; }
        .echo-consensus-row { display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:center; }
        .echo-consensus-row b { font-size:24px; color:#e0b341; }
        .echo-consensus-row span { color:#cfe0ff; line-height:1.5; }
        .echo-list-row { display:grid; grid-template-columns:28px 1fr auto auto; gap:8px; align-items:center; }
        .echo-list-row small { color:#8b97a8; }
        .echo-audit-row { display:grid; grid-template-columns:28px 1fr auto 24px; gap:8px; align-items:center; }
        .echo-audit-row strong { text-align:center; }
      `}</style>

      <header className="hero"><div className="hero-kicker">Adaptive Historical Matching</div><h1>Echo Engine</h1><p>Satu rekomendasi utama dengan discovery, holdout, dan pola live yang dipisahkan.</p></header>
      <div className="sync-status">{syncText}</div>
      <AppPromoBanner />

      <EchoControlPanel
        selectedMarket={selectedMarket}
        filteredMarkets={filteredMarkets}
        marketId={marketId}
        marketQuery={marketQuery}
        marketOpen={isOpen("market")}
        jenisOpen={isOpen("jenis")}
        targetOpen={isOpen("target")}
        digitOpen={isOpen("digit")}
        scanMode={scanMode}
        targetPos={targetPos}
        target2D={target2D}
        target3D={target3D}
        targetText={targetText}
        digitCount={digitCount}
        loading={loading}
        error={echoError || marketError}
        onOpenMarket={() => { if (!isOpen("market")) setMarketQuery(""); toggleDropdown("market"); }}
        onCloseMarket={closeDropdown}
        onMarketQueryChange={setMarketQuery}
        onSelectMarket={chooseMarket}
        onSelectJenis={chooseMode}
        onToggleJenis={() => toggleDropdown("jenis")}
        onToggleTarget={() => toggleDropdown("target")}
        onSelectTargetPos={(value) => { setTargetPos(value); closeDropdown(); }}
        onSelectTarget2D={(value) => { setTarget2D(value); closeDropdown(); }}
        onSelectTarget3D={(value) => { setTarget3D(value); closeDropdown(); }}
        onToggleDigit={() => toggleDropdown("digit")}
        onSelectDigit={(value) => { setDigitCount(value); closeDropdown(); }}
        onRun={startEcho}
      />

      {result && !item && <div className="panel scan-empty">Echo belum menemukan profile yang dapat dievaluasi.</div>}
      {item && <EchoResultView item={item} marketName={resolvedMarketName} />}
      <BottomNav />
    </div>
  );
}
