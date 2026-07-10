"use client";

import { useMemo, useState } from "react";
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

const overlayStyle = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 80,
  display: "grid",
  alignItems: "end",
  background: "rgba(0,0,0,.62)",
};

const sheetStyle = {
  width: "min(100%, 620px)",
  maxHeight: "88vh",
  margin: "0 auto",
  overflowY: "auto" as const,
  padding: "18px 16px calc(24px + env(safe-area-inset-bottom))",
  border: "1px solid rgba(110,155,255,.28)",
  borderBottom: 0,
  borderRadius: "22px 22px 0 0",
  background: "#111823",
  boxShadow: "0 -22px 50px rgba(0,0,0,.48)",
};

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

function confidenceClass(level: EchoItem["confidenceLevel"]) {
  return level === "HIGH" ? "role-1" : level === "MEDIUM" ? "role-2" : "role-3";
}

function EchoDetail({ item, marketName, onClose }: { item: EchoItem; marketName: string; onClose: () => void }) {
  const copyText = useMemo(() => {
    const digits = labelsFromValues(item.angkaHidup, item.scanMode).join(isShioMode(item.scanMode) ? "-" : "");
    const windows = item.audit.windows.map((window) => `L${window.window} ${window.hit}/${window.total}`).join(" · ");
    return [
      `*${marketName.toUpperCase()} · ECHO ENGINE*`,
      `${analysisTitle(item.scanMode, item.targetPos, item.target2D, item.target3D)} · ${profileTitle(item)}`,
      `Output: ${digits}`,
      `Audit otomatis: ${item.audit.weightedAccuracy}%`,
      windows,
      `Recent: ${item.audit.recentHit}/${item.audit.recentTotal}`,
      `Keyakinan live: ${item.confidenceLevel} ${item.confidence}`,
    ].join("\n");
  }, [item, marketName]);

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      const area = document.createElement("textarea");
      area.value = copyText;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={sheetStyle} onClick={(event) => event.stopPropagation()}>
        <div className="frequency-head">
          <div>
            <b>{marketName.toUpperCase()}</b>
            <span style={{ display: "block", marginTop: 4 }}>{profileTitle(item)} · <code>{item.formula}</code></span>
          </div>
          <button className="view-btn compact-view" type="button" onClick={onClose}>Tutup</button>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <p className="summary"><b>Prediksi Live</b></p>
          <div className="compact-digits">
            {labelsFromValues(item.angkaHidup, item.scanMode).map((digit, index) => <span key={`${digit}-${index}`}>{digit}</span>)}
          </div>
          <p style={{ marginBottom: 0, lineHeight: 1.7 }}>
            Result terakhir: <b>{item.result.latestDraw}</b><br />
            Patokan Echo: <b>{item.result.patokan}</b><br />
            Kolom: <b>{item.activeColumns}</b><br />
            Kondisi: <b>{item.echo.regime}</b><br />
            Keyakinan live: <b>{item.confidenceLevel} {item.confidence}</b>
          </p>
        </div>

        <div className="panel">
          <p className="summary"><b>Penilaian Otomatis</b></p>
          <div className="frequency-grid">
            <div className="frequency-item"><b>{item.audit.weightedAccuracy}%</b><span>Akurasi gabungan</span></div>
            <div className="frequency-item"><b>{item.audit.recentHit}/{item.audit.recentTotal}</b><span>Recent</span></div>
            <div className="frequency-item"><b>{item.audit.windowStability}%</b><span>Stabilitas window</span></div>
            <div className="frequency-item"><b>L{item.audit.strongestWindow}</b><span>Window terkuat</span></div>
            <div className="frequency-item"><b>L{item.audit.weakestWindow}</b><span>Window terlemah</span></div>
            <div className="frequency-item"><b>{item.audit.longestMissStreak}</b><span>Miss terpanjang</span></div>
          </div>
        </div>

        <div className="panel">
          <p className="summary"><b>Audit Multi-Window</b></p>
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
          <p className="summary"><b>Kualitas Pola Live</b></p>
          <div className="frequency-grid">
            <div className="frequency-item"><b>{item.echo.effectiveNeighbors}</b><span>Echo efektif</span></div>
            <div className="frequency-item"><b>{item.echo.meanDistance}</b><span>Jarak rata-rata</span></div>
            <div className="frequency-item"><b>{item.echo.dominantShare}%</b><span>Vote dominan</span></div>
            <div className="frequency-item"><b>{item.echo.stability}%</b><span>Stabilitas analog</span></div>
          </div>
        </div>

        <div className="panel">
          <p className="summary"><b>Analog Historis Terdekat</b></p>
          <div style={{ display: "grid", gap: 8 }}>
            {item.result.neighbors.slice(0, 12).map((neighbor, index) => (
              <div className="frequency-item" key={`${neighbor.anchorIndex}-${index}`} style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 8 }}>
                <b>{index + 1}</b>
                <span>{neighbor.anchorDraw} ➜ {neighbor.nextDraw}</span>
                <span>Δ{neighbor.movement > 0 ? "+" : ""}{neighbor.movement} · {neighbor.distance.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <p className="summary"><b>Audit Walk-Forward</b></p>
          <div style={{ display: "grid", gap: 8 }}>
            {item.result.rows.map((row, index) => (
              <div className="frequency-item" key={`${row.targetIndex}-${index}`} style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 8 }}>
                <b>{index + 1}</b>
                <span>{row.displayDraw} ➜ {row.targetDraw} · P{row.patokan}</span>
                <span>{row.covered ? "✓" : "×"}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="run" type="button" onClick={copyResult}>Salin Hasil</button>
      </section>
    </div>
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
  const [stopScan, setStopScan] = useState("3");
  const [detail, setDetail] = useState<EchoItem | null>(null);
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
      stopScan,
      onDigitCountChange: setDigitCount,
      onStopScanChange: setStopScan,
      onBeforeRun: () => {
        setDetail(null);
        closeDropdown();
      },
    });
  }

  return (
    <div className="wrap">
      <style>{`
        .echo-audit-info { margin: 2px 0 16px; padding: 13px 14px; border: 1px solid rgba(224,179,65,.24); border-radius: 14px; background: rgba(224,179,65,.07); }
        .echo-audit-info > div { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .echo-audit-info b { color:#e9eef5; font-size:13px; }
        .echo-audit-info span { color:#e0b341; font-size:12px; font-weight:950; }
        .echo-audit-info p { margin:6px 0 0; color:#8b97a8; font-size:12px; line-height:1.5; }
        .echo-profile-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
        .echo-profile-head code { color:#8b97a8; font-size:10px; }
        .echo-meta { display:flex; flex-wrap:wrap; gap:7px; margin-top:9px; }
        .echo-meta span { padding:5px 8px; border-radius:9px; background:rgba(110,155,255,.08); font-size:11px; color:#cfe0ff; }
        .echo-window-list { display:grid; gap:8px; }
        .echo-window-row { display:grid; grid-template-columns:42px 1fr auto auto; align-items:center; gap:9px; }
        .echo-window-row strong { color:#e0b341; }
        .echo-window-row small { color:#8b97a8; }
      `}</style>
      <header className="hero"><div className="hero-kicker">Adaptive Historical Matching</div><h1>Echo Engine</h1><p>Engine memilih analog historis dan menguji kestabilannya secara otomatis.</p></header>
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
        stopScan={stopScan}
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
        onStopScanChange={setStopScan}
        onRun={startEcho}
      />

      {result && (
        <div className="panel result-panel">
          <p className="summary">
            <b>{marketName}</b> · <b>{analysisTitle(result.config.scanMode, result.config.targetPos, result.config.target2D, result.config.target3D)}</b> · {result.config.digitCount} {isShioMode(result.config.scanMode) ? "shio" : "digit"} · audit {result.config.auditWindows.map((window) => `L${window}`).join(" · ")} · {result.items.length} rekomendasi
          </p>
          <div className="scan-list compact-list">
            {result.items.length === 0 && <div className="scan-empty">Belum ada pola Echo yang cukup kuat.</div>}
            {result.items.map((item, index) => (
              <div className={`scan-item compact ${confidenceClass(item.confidenceLevel)}`} key={`${item.formula}-${index}`}>
                <div className="scan-row-body">
                  <div className="echo-profile-head">
                    <span className={`scan-formula compact-formula role-${Math.min(index + 1, 3)}`}>{profileTitle(item)}</span>
                    <code>{item.formula}</code>
                  </div>
                  <div className="compact-digits">
                    {labelsFromValues(item.angkaHidup, item.scanMode).map((digit, digitIndex) => <span key={`${digit}-${digitIndex}`}>{digit}</span>)}
                  </div>
                  <div className="echo-meta">
                    <span>Audit {item.audit.weightedAccuracy}%</span>
                    <span>Recent {item.audit.recentHit}/{item.audit.recentTotal}</span>
                    <span>Window {item.audit.windowStability}%</span>
                    <span>Live {item.confidenceLevel} {item.confidence}</span>
                  </div>
                  <div className="scan-actions" style={{ marginTop: 10 }}>
                    <button className="view-btn compact-view" type="button" onClick={() => setDetail(item)}>Lihat Detail</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail && <EchoDetail item={detail} marketName={marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran"} onClose={() => setDetail(null)} />}
      <BottomNav />
    </div>
  );
}
