import {
  ANALYSIS_LABEL,
  ANALYSIS_OPTIONS,
  DATA_HINT_FIELD_STYLE,
  DATA_HINT_INPUT_STYLE,
  DATA_HINT_STYLE,
  DIGIT_OPTIONS,
  NO_BADGE_OPTION_STYLE,
  NO_BADGE_SELECT_STYLE,
  POS_OPTIONS,
  TARGET_2D_OPTIONS,
} from "../constants";
import { cleanDigits, clampTextNumber, isOffMode, isPositionMode, isShioMode, marketTitle } from "../helpers";
import type { Market, Posisi, ScanMode, Target2D } from "../types";

type Props = {
  selectedMarket: Market | null;
  filteredMarkets: Market[];
  marketId: string;
  marketQuery: string;
  marketOpen: boolean;
  jenisOpen: boolean;
  targetOpen: boolean;
  digitOpen: boolean;
  rounds: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  targetText: string;
  digitCount: number;
  stopScan: string;
  loading: boolean;
  error: string;
  onOpenMarket: () => void;
  onCloseMarket: () => void;
  onMarketQueryChange: (value: string) => void;
  onSelectMarket: (market: Market) => void;
  onRoundsChange: (value: string) => void;
  onSelectJenis: (mode: ScanMode) => void;
  onToggleJenis: () => void;
  onToggleTarget: () => void;
  onSelectTargetPos: (value: Posisi) => void;
  onSelectTarget2D: (value: Target2D) => void;
  onToggleDigit: () => void;
  onSelectDigit: (value: number) => void;
  onStopScanChange: (value: string) => void;
  onScan: () => void;
};

export default function ScanControlPanel({
  selectedMarket,
  filteredMarkets,
  marketId,
  marketQuery,
  marketOpen,
  jenisOpen,
  targetOpen,
  digitOpen,
  rounds,
  scanMode,
  targetPos,
  target2D,
  targetText,
  digitCount,
  stopScan,
  loading,
  error,
  onOpenMarket,
  onCloseMarket,
  onMarketQueryChange,
  onSelectMarket,
  onRoundsChange,
  onSelectJenis,
  onToggleJenis,
  onToggleTarget,
  onSelectTargetPos,
  onSelectTarget2D,
  onToggleDigit,
  onSelectDigit,
  onStopScanChange,
  onScan,
}: Props) {
  return (
    <div className="panel">
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

      <div className="row two">
        <div className="field" style={DATA_HINT_FIELD_STYLE}>
          <label>Data Uji</label>
          <input inputMode="numeric" style={DATA_HINT_INPUT_STYLE} value={rounds} onChange={(event) => onRoundsChange(cleanDigits(event.target.value, 3))} onBlur={() => onRoundsChange(String(clampTextNumber(rounds, 14, 1, 100)))} />
          <span style={DATA_HINT_STYLE}>maks.100</span>
        </div>
        <div className="field trek-field">
          <label>Jenis</label>
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
      </div>

      <div className="row two">
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
                      <span className="option-label">{item.label}</span>
                      {item.value === targetPos && <b>✓</b>}
                    </button>
                  ))
                : TARGET_2D_OPTIONS.map((item) => (
                    <button key={item.value} type="button" style={NO_BADGE_OPTION_STYLE} className={item.value === target2D ? "trek-option active" : "trek-option"} onClick={() => onSelectTarget2D(item.value)}>
                      <span className="option-label">{item.label}</span>
                      {item.value === target2D && <b>✓</b>}
                    </button>
                  ))}
            </div>
          )}
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
                  <span className="option-label">{value} {isShioMode(scanMode) ? "shio" : "digit"}</span>
                  {value === digitCount && <b>✓</b>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="field">
        <label>Batas Hasil</label>
        <input inputMode="numeric" value={stopScan} onChange={(event) => onStopScanChange(cleanDigits(event.target.value, 3))} onBlur={() => onStopScanChange(String(clampTextNumber(stopScan, 1, 1, 200)))} />
      </div>
      <button className="run" onClick={onScan} disabled={loading || !marketId}>{loading ? "Sedang scan..." : "Scan Sekarang"}</button>
      {error && <div className="err">{error}</div>}
    </div>
  );
}
