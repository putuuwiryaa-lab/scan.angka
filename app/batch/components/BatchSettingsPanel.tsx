import { useState } from "react";
import { ANALYSIS_OPTIONS, DIGIT_OPTIONS, POS_OPTIONS, TARGET_2D_OPTIONS, TARGET_3D_OPTIONS } from "../../shared/scan-options";
import { cleanDigits, clampTextNumber, is3DMode, isOffMode, isPositionMode, isShioMode } from "../../shared/scan-utils";
import type { Posisi, ScanMode, Target2D, Target3D } from "../../shared/types";

type Props = {
  rounds: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  topCount: number;
  secondaryScanMode: ScanMode | "";
  secondaryRounds: string;
  secondaryTargetPos: Posisi;
  secondaryTarget2D: Target2D;
  secondaryTarget3D: Target3D;
  secondaryDigitCount: number;
  secondaryTopCount: number;
  onRoundsChange: (value: string) => void;
  onScanModeChange: (value: ScanMode) => void;
  onTargetPosChange: (value: Posisi) => void;
  onTarget2DChange: (value: Target2D) => void;
  onTarget3DChange: (value: Target3D) => void;
  onDigitCountChange: (value: number) => void;
  onTopCountChange: (value: number) => void;
  onSecondaryScanModeChange: (value: ScanMode | "") => void;
  onSecondaryRoundsChange: (value: string) => void;
  onSecondaryTargetPosChange: (value: Posisi) => void;
  onSecondaryTarget2DChange: (value: Target2D) => void;
  onSecondaryTarget3DChange: (value: Target3D) => void;
  onSecondaryDigitCountChange: (value: number) => void;
  onSecondaryTopCountChange: (value: number) => void;
};

type OpenMenu = "m1Jenis" | "m1Target" | "m1Digit" | "m1Top" | "m2Jenis" | "m2Target" | "m2Digit" | "m2Top" | null;

const TOP_OPTIONS = [1, 2, 3];

function optionLabel<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((item) => item.value === value)?.label ?? value;
}

function targetLabel(scanMode: ScanMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D): string {
  return isPositionMode(scanMode)
    ? optionLabel(POS_OPTIONS, targetPos)
    : is3DMode(scanMode)
      ? optionLabel(TARGET_3D_OPTIONS, target3D)
      : optionLabel(TARGET_2D_OPTIONS, target2D);
}

function digitLabel(scanMode: ScanMode, digitCount: number): string {
  return `${digitCount} ${isShioMode(scanMode) ? "shio" : "digit"}`;
}

export default function BatchSettingsPanel({
  rounds,
  scanMode,
  targetPos,
  target2D,
  target3D,
  digitCount,
  topCount,
  secondaryScanMode,
  secondaryRounds,
  secondaryTargetPos,
  secondaryTarget2D,
  secondaryTarget3D,
  secondaryDigitCount,
  secondaryTopCount,
  onRoundsChange,
  onScanModeChange,
  onTargetPosChange,
  onTarget2DChange,
  onTarget3DChange,
  onDigitCountChange,
  onTopCountChange,
  onSecondaryScanModeChange,
  onSecondaryRoundsChange,
  onSecondaryTargetPosChange,
  onSecondaryTarget2DChange,
  onSecondaryTarget3DChange,
  onSecondaryDigitCountChange,
  onSecondaryTopCountChange,
}: Props) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const secondaryActive = Boolean(secondaryScanMode);

  function toggle(menu: Exclude<OpenMenu, null>) {
    setOpenMenu((current) => current === menu ? null : menu);
  }

  function renderTargetMenu(method: "m1" | "m2", mode: ScanMode, selectedPos: Posisi, selected2D: Target2D, selected3D: Target3D, onPos: (value: Posisi) => void, on2D: (value: Target2D) => void, on3D: (value: Target3D) => void) {
    const menuKey = method === "m1" ? "m1Target" : "m2Target";
    return openMenu === menuKey && (
      <div className="batch-select-menu">
        {isPositionMode(mode)
          ? POS_OPTIONS.map((item) => (
              <button key={item.value} type="button" className={item.value === selectedPos ? "batch-select-option active" : "batch-select-option"} onClick={() => { onPos(item.value); setOpenMenu(null); }}>
                <span>{item.label}</span>
                {item.value === selectedPos && <b>✓</b>}
              </button>
            ))
          : is3DMode(mode)
            ? TARGET_3D_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={item.value === selected3D ? "batch-select-option active" : "batch-select-option"} onClick={() => { on3D(item.value); setOpenMenu(null); }}>
                  <span>{item.label}</span>
                  {item.value === selected3D && <b>✓</b>}
                </button>
              ))
            : TARGET_2D_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={item.value === selected2D ? "batch-select-option active" : "batch-select-option"} onClick={() => { on2D(item.value); setOpenMenu(null); }}>
                  <span>{item.label}</span>
                  {item.value === selected2D && <b>✓</b>}
                </button>
              ))}
      </div>
    );
  }

  function renderDigitMenu(method: "m1" | "m2", mode: ScanMode, selectedDigit: number, onDigit: (value: number) => void) {
    const menuKey = method === "m1" ? "m1Digit" : "m2Digit";
    return openMenu === menuKey && (
      <div className="batch-select-menu">
        {DIGIT_OPTIONS.filter((value) => isShioMode(mode) || value <= 9).map((value) => {
          const label = `${value} ${isShioMode(mode) ? "shio" : "digit"}`;
          return (
            <button key={value} type="button" className={value === selectedDigit ? "batch-select-option active" : "batch-select-option"} onClick={() => { onDigit(value); setOpenMenu(null); }}>
              <span>{label}</span>
              {value === selectedDigit && <b>✓</b>}
            </button>
          );
        })}
      </div>
    );
  }

  function renderTopMenu(method: "m1" | "m2", selectedTop: number, onTop: (value: number) => void) {
    const menuKey = method === "m1" ? "m1Top" : "m2Top";
    return openMenu === menuKey && (
      <div className="batch-select-menu">
        {TOP_OPTIONS.map((value) => (
          <button key={value} type="button" className={value === selectedTop ? "batch-select-option active" : "batch-select-option"} onClick={() => { onTop(value); setOpenMenu(null); }}>
            <span>Top {value}</span>
            {value === selectedTop && <b>✓</b>}
          </button>
        ))}
      </div>
    );
  }

  return (
    <section className="batch-panel">
      <div className="batch-method-grid">
        <div className="batch-method-card">
          <div className="batch-method-title">Metode 1</div>
          <div className="batch-field">
            <label>Data Uji</label>
            <input className="batch-input" inputMode="numeric" value={rounds} onChange={(event) => onRoundsChange(cleanDigits(event.target.value, 3))} onBlur={() => onRoundsChange(String(clampTextNumber(rounds, 14, 1, 100)))} />
          </div>
          <div className="batch-field batch-dropdown-field">
            <label>Jenis</label>
            <button className="batch-select-btn" type="button" onClick={() => toggle("m1Jenis")}>
              <b>{optionLabel(ANALYSIS_OPTIONS, scanMode)}</b>
              <span>{openMenu === "m1Jenis" ? "⌃" : "⌄"}</span>
            </button>
            {openMenu === "m1Jenis" && (
              <div className="batch-select-menu">
                {ANALYSIS_OPTIONS.map((item) => (
                  <button key={item.value} type="button" className={item.value === scanMode ? "batch-select-option active" : "batch-select-option"} onClick={() => { onScanModeChange(item.value); setOpenMenu(null); }}>
                    <span>{item.label}</span>
                    {item.value === scanMode && <b>✓</b>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="batch-row-two">
            <div className="batch-field batch-dropdown-field">
              <label>Target</label>
              <button className="batch-select-btn" type="button" onClick={() => toggle("m1Target")}>
                <b>{targetLabel(scanMode, targetPos, target2D, target3D)}</b>
                <span>{openMenu === "m1Target" ? "⌃" : "⌄"}</span>
              </button>
              {renderTargetMenu("m1", scanMode, targetPos, target2D, target3D, onTargetPosChange, onTarget2DChange, onTarget3DChange)}
            </div>
            <div className="batch-field batch-dropdown-field">
              <label>{isOffMode(scanMode) ? (isShioMode(scanMode) ? "OFF Shio" : "Jumlah OFF") : (isShioMode(scanMode) ? "Jumlah Shio" : "Jumlah Digit")}</label>
              <button className="batch-select-btn" type="button" onClick={() => toggle("m1Digit")}>
                <b>{digitLabel(scanMode, digitCount)}</b>
                <span>{openMenu === "m1Digit" ? "⌃" : "⌄"}</span>
              </button>
              {renderDigitMenu("m1", scanMode, digitCount, onDigitCountChange)}
            </div>
          </div>
          <div className="batch-field batch-dropdown-field">
            <label>Top Hasil</label>
            <button className="batch-select-btn" type="button" onClick={() => toggle("m1Top")}>
              <b>Top {topCount}</b>
              <span>{openMenu === "m1Top" ? "⌃" : "⌄"}</span>
            </button>
            {renderTopMenu("m1", topCount, onTopCountChange)}
          </div>
        </div>

        <div className={secondaryActive ? "batch-method-card" : "batch-method-card inactive"}>
          <div className="batch-method-title">Metode 2</div>
          <div className="batch-field batch-dropdown-field">
            <label>Jenis</label>
            <button className="batch-select-btn" type="button" onClick={() => toggle("m2Jenis")}>
              <b>{secondaryScanMode ? optionLabel(ANALYSIS_OPTIONS, secondaryScanMode) : "Tidak dipakai"}</b>
              <span>{openMenu === "m2Jenis" ? "⌃" : "⌄"}</span>
            </button>
            {openMenu === "m2Jenis" && (
              <div className="batch-select-menu">
                <button type="button" className={secondaryScanMode === "" ? "batch-select-option active" : "batch-select-option"} onClick={() => { onSecondaryScanModeChange(""); setOpenMenu(null); }}>
                  <span>Tidak dipakai</span>
                  {secondaryScanMode === "" && <b>✓</b>}
                </button>
                {ANALYSIS_OPTIONS.map((item) => (
                  <button key={item.value} type="button" className={item.value === secondaryScanMode ? "batch-select-option active" : "batch-select-option"} onClick={() => { onSecondaryScanModeChange(item.value); setOpenMenu(null); }}>
                    <span>{item.label}</span>
                    {item.value === secondaryScanMode && <b>✓</b>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {secondaryActive && secondaryScanMode && (
            <>
              <div className="batch-field">
                <label>Data Uji</label>
                <input className="batch-input" inputMode="numeric" value={secondaryRounds} onChange={(event) => onSecondaryRoundsChange(cleanDigits(event.target.value, 3))} onBlur={() => onSecondaryRoundsChange(String(clampTextNumber(secondaryRounds, 14, 1, 100)))} />
              </div>
              <div className="batch-row-two">
                <div className="batch-field batch-dropdown-field">
                  <label>Target</label>
                  <button className="batch-select-btn" type="button" onClick={() => toggle("m2Target")}>
                    <b>{targetLabel(secondaryScanMode, secondaryTargetPos, secondaryTarget2D, secondaryTarget3D)}</b>
                    <span>{openMenu === "m2Target" ? "⌃" : "⌄"}</span>
                  </button>
                  {renderTargetMenu("m2", secondaryScanMode, secondaryTargetPos, secondaryTarget2D, secondaryTarget3D, onSecondaryTargetPosChange, onSecondaryTarget2DChange, onSecondaryTarget3DChange)}
                </div>
                <div className="batch-field batch-dropdown-field">
                  <label>{isOffMode(secondaryScanMode) ? (isShioMode(secondaryScanMode) ? "OFF Shio" : "Jumlah OFF") : (isShioMode(secondaryScanMode) ? "Jumlah Shio" : "Jumlah Digit")}</label>
                  <button className="batch-select-btn" type="button" onClick={() => toggle("m2Digit")}>
                    <b>{digitLabel(secondaryScanMode, secondaryDigitCount)}</b>
                    <span>{openMenu === "m2Digit" ? "⌃" : "⌄"}</span>
                  </button>
                  {renderDigitMenu("m2", secondaryScanMode, secondaryDigitCount, onSecondaryDigitCountChange)}
                </div>
              </div>
              <div className="batch-field batch-dropdown-field">
                <label>Top Hasil</label>
                <button className="batch-select-btn" type="button" onClick={() => toggle("m2Top")}>
                  <b>Top {secondaryTopCount}</b>
                  <span>{openMenu === "m2Top" ? "⌃" : "⌄"}</span>
                </button>
                {renderTopMenu("m2", secondaryTopCount, onSecondaryTopCountChange)}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}