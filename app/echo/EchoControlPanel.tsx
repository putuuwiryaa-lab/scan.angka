import {
  ANALYSIS_LABEL,
  ANALYSIS_OPTIONS,
  DIGIT_OPTIONS,
  NO_BADGE_OPTION_STYLE,
  NO_BADGE_SELECT_STYLE,
  POS_OPTIONS,
  TARGET_2D_OPTIONS,
  TARGET_3D_OPTIONS,
} from "../scan/constants";
import { is3DMode, isOffMode, isPositionMode, isShioMode, marketTitle } from "../shared/scan-utils";
import type { Market, Posisi, ScanMode, Target2D, Target3D } from "../scan/types";

type Props = {
  selectedMarket: Market | null;
  filteredMarkets: Market[];
  marketId: string;
  marketQuery: string;
  marketOpen: boolean;
  jenisOpen: boolean;
  targetOpen: boolean;
  digitOpen: boolean;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  targetText: string;
  digitCount: number;
  loading: boolean;
  error: string;
  onOpenMarket: () => void;
  onCloseMarket: () => void;
  onMarketQueryChange: (value: string) => void;
  onSelectMarket: (market: Market) => void;
  onSelectJenis: (mode: ScanMode) => void;
  onToggleJenis: () => void;
  onToggleTarget: () => void;
  onSelectTargetPos: (value: Posisi) => void;
  onSelectTarget2D: (value: Target2D) => void;
  onSelectTarget3D: (value: Target3D) => void;
  onToggleDigit: () => void;
  onSelectDigit: (value: number) => void;
  onRun: () => void;
};

export default function EchoControlPanel({
  selectedMarket,
  filteredMarkets,
  marketId,
  marketQuery,
  marketOpen,
  jenisOpen,
  targetOpen,
  digitOpen,
  scanMode,
  targetPos,
  target2D,
  target3D,
  targetText,
  digitCount,
  loading,
  error,
  onOpenMarket,
  onCloseMarket,
  onMarketQueryChange,
  onSelectMarket,
  onSelectJenis,
  onToggleJenis,
  onToggleTarget,
  onSelectTargetPos,
  onSelectTarget2D,
  onSelectTarget3D,
  onToggleDigit,
  onSelectDigit,
  onRun,
}: Props) {
  return (
    <div className="panel echo-control-panel">
      <div className="field market-field">
        <label>Pasaran</label>
        <button className="market-select" type="button" onClick={onOpenMarket}>
          <span className="select-badge" />
          <b>{selectedMarket ? marketTitle(selectedMarket) : "Pilih pasaran"}</b>
          <span className="latest-result">{selectedMarket?.latestResult ?? "----"}</span>
          <span className="select-arrow">{marketOpen ? "⌃" : "⌄"}</span>
        </button>
        {marketOpen && (
          <div className="market-menu">
            <div className="market-menu-top">
              <input className="market-search" value={marketQuery} onChange={(event) => onMarketQueryChange(event.target.value)} placeholder="Cari pasaran..." autoFocus />
              <button type="button" onClick={onCloseMarket}>×</button>
            </div>
            {filteredMarkets.length === 0 && <div className="market-empty">Pasaran tidak ditemukan</div>}
            {filteredMarkets.map((market) => (
              <button key={market.id} type="button" className={market.id === marketId ? "market-option active" : "market-option"} onClick={() => onSelectMarket(market)}>
                <span className="option-badge" />
                <span className="option-label">{marketTitle(market)}</span>
                {market.latestResult && <em>{market.latestResult}</em>}
                {market.id === marketId && <b>✓</b>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="echo-audit-info">
        <div><b>Evaluasi Otomatis</b><span>Discovery L12 · L20 · L30</span></div>
        <p>Kolom dipilih dari data discovery, lalu diverifikasi pada 12 result holdout yang tidak ikut memilih kolom.</p>
      </div>

      <div className="row two">
        <div className="field trek-field">
          <label>Jenis Prediksi</label>
          <button className="trek-select" style={NO_BADGE_SELECT_STYLE} type="button" onClick={onToggleJenis}>
            <b>{ANALYSIS_LABEL[scanMode]}</b>
            <span className="select-arrow">{jenisOpen ? "⌃" : "⌄"}</span>
          </button>
          {jenisOpen && (
            <div className="trek-menu">
              {ANALYSIS_OPTIONS.map((item) => (
                <button key={item.value} type="button" style={NO_BADGE_OPTION_STYLE} className={item.value === scanMode ? "trek-option active" : "trek-option"} onClick={() => onSelectJenis(item.value)}>
                  <span className="option-label">{item.label}</span>
                  {item.value === scanMode && <b>✓</b>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field trek-field">
          <label>Target</label>
          <button className="trek-select" style={NO_BADGE_SELECT_STYLE} type="button" onClick={onToggleTarget}>
            <b>{targetText}</b>
            <span className="select-arrow">{targetOpen ? "⌃" : "⌄"}</span>
          </button>
          {targetOpen && (
            <div className="trek-menu">
              {isPositionMode(scanMode)
                ? POS_OPTIONS.map((item) => (
                    <button key={item.value} type="button" style={NO_BADGE_OPTION_STYLE} className={item.value === targetPos ? "trek-option active" : "trek-option"} onClick={() => onSelectTargetPos(item.value)}>
                      <span className="option-label">{item.label}</span>{item.value === targetPos && <b>✓</b>}
                    </button>
                  ))
                : is3DMode(scanMode)
                  ? TARGET_3D_OPTIONS.map((item) => (
                      <button key={item.value} type="button" style={NO_BADGE_OPTION_STYLE} className={item.value === target3D ? "trek-option active" : "trek-option"} onClick={() => onSelectTarget3D(item.value)}>
                        <span className="option-label">{item.label}</span>{item.value === target3D && <b>✓</b>}
                      </button>
                    ))
                  : TARGET_2D_OPTIONS.map((item) => (
                      <button key={item.value} type="button" style={NO_BADGE_OPTION_STYLE} className={item.value === target2D ? "trek-option active" : "trek-option"} onClick={() => onSelectTarget2D(item.value)}>
                        <span className="option-label">{item.label}</span>{item.value === target2D && <b>✓</b>}
                      </button>
                    ))}
            </div>
          )}
        </div>
      </div>

      <div className="field digit-field">
        <label>{isOffMode(scanMode) ? (isShioMode(scanMode) ? "Jumlah OFF Shio" : "Jumlah OFF") : (isShioMode(scanMode) ? "Jumlah Shio" : "Jumlah Digit")}</label>
        <button className="digit-select" style={NO_BADGE_SELECT_STYLE} type="button" onClick={onToggleDigit}>
          <b>{digitCount} {isShioMode(scanMode) ? "shio" : "digit"}</b>
          <span className="select-arrow">{digitOpen ? "⌃" : "⌄"}</span>
        </button>
        {digitOpen && (
          <div className="digit-menu">
            {DIGIT_OPTIONS.filter((value) => isShioMode(scanMode) || value <= 9).map((value) => (
              <button key={value} type="button" style={NO_BADGE_OPTION_STYLE} className={value === digitCount ? "digit-option active" : "digit-option"} onClick={() => onSelectDigit(value)}>
                <span className="option-label">{value} {isShioMode(scanMode) ? "shio" : "digit"}</span>{value === digitCount && <b>✓</b>}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="run" onClick={onRun} disabled={loading || !marketId}>{loading ? "Menganalisa Echo..." : "Cari Rekomendasi Terbaik"}</button>
      {error && <div className="err">{error}</div>}
    </div>
  );
}
