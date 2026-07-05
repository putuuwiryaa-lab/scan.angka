import { useState } from "react";
import { ANALYSIS_OPTIONS, DIGIT_OPTIONS, POS_OPTIONS, TARGET_2D_OPTIONS, TARGET_3D_OPTIONS } from "../../shared/scan-options";
import { cleanDigits, clampTextNumber, is3DMode, isOffMode, isPositionMode, isShioMode } from "../../shared/scan-utils";
import type { Posisi, ScanMode, Target2D, Target3D } from "../../shared/types";

type Props = {
  rounds: string;
  scanMode: ScanMode;
  secondaryScanMode: ScanMode | "";
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  topCount: number;
  onRoundsChange: (value: string) => void;
  onScanModeChange: (value: ScanMode) => void;
  onSecondaryScanModeChange: (value: ScanMode | "") => void;
  onTargetPosChange: (value: Posisi) => void;
  onTarget2DChange: (value: Target2D) => void;
  onTarget3DChange: (value: Target3D) => void;
  onDigitCountChange: (value: number) => void;
  onTopCountChange: (value: number) => void;
};

type OpenMenu = "jenis" | "jenis2" | "target" | "digit" | "top" | null;

const TOP_OPTIONS = [1, 2, 3];

function optionLabel<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((item) => item.value === value)?.label ?? value;
}

export default function BatchSettingsPanel({
  rounds,
  scanMode,
  secondaryScanMode,
  targetPos,
  target2D,
  target3D,
  digitCount,
  topCount,
  onRoundsChange,
  onScanModeChange,
  onSecondaryScanModeChange,
  onTargetPosChange,
  onTarget2DChange,
  onTarget3DChange,
  onDigitCountChange,
  onTopCountChange,
}: Props) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const digitLabel = `${digitCount} ${isShioMode(scanMode) ? "shio" : "digit"}`;
  const topLabel = `Top ${topCount}`;
  const targetLabel = isPositionMode(scanMode)
    ? optionLabel(POS_OPTIONS, targetPos)
    : is3DMode(scanMode)
      ? optionLabel(TARGET_3D_OPTIONS, target3D)
      : optionLabel(TARGET_2D_OPTIONS, target2D);
  const secondaryLabel = secondaryScanMode ? optionLabel(ANALYSIS_OPTIONS, secondaryScanMode) : "Tidak dipakai";

  function toggle(menu: Exclude<OpenMenu, null>) {
    setOpenMenu((current) => current === menu ? null : menu);
  }

  return (
    <section className="batch-panel">
      <div className="batch-row-two">
        <div className="batch-field">
          <label>Data Uji</label>
          <input className="batch-input" inputMode="numeric" value={rounds} onChange={(event) => onRoundsChange(cleanDigits(event.target.value, 3))} onBlur={() => onRoundsChange(String(clampTextNumber(rounds, 14, 1, 100)))} />
        </div>
        <div className="batch-field batch-dropdown-field">
          <label>Metode 1</label>
          <button className="batch-select-btn" type="button" onClick={() => toggle("jenis")}>
            <b>{optionLabel(ANALYSIS_OPTIONS, scanMode)}</b>
            <span>{openMenu === "jenis" ? "⌃" : "⌄"}</span>
          </button>
          {openMenu === "jenis" && (
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
      </div>

      <div className="batch-row-two">
        <div className="batch-field batch-dropdown-field">
          <label>Metode 2</label>
          <button className="batch-select-btn" type="button" onClick={() => toggle("jenis2")}>
            <b>{secondaryLabel}</b>
            <span>{openMenu === "jenis2" ? "⌃" : "⌄"}</span>
          </button>
          {openMenu === "jenis2" && (
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
        <div className="batch-field batch-dropdown-field">
          <label>Top Hasil</label>
          <button className="batch-select-btn" type="button" onClick={() => toggle("top")}>
            <b>{topLabel}</b>
            <span>{openMenu === "top" ? "⌃" : "⌄"}</span>
          </button>
          {openMenu === "top" && (
            <div className="batch-select-menu">
              {TOP_OPTIONS.map((value) => (
                <button key={value} type="button" className={value === topCount ? "batch-select-option active" : "batch-select-option"} onClick={() => { onTopCountChange(value); setOpenMenu(null); }}>
                  <span>Top {value}</span>
                  {value === topCount && <b>✓</b>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="batch-row-two">
        <div className="batch-field batch-dropdown-field">
          <label>Target</label>
          <button className="batch-select-btn" type="button" onClick={() => toggle("target")}>
            <b>{targetLabel}</b>
            <span>{openMenu === "target" ? "⌃" : "⌄"}</span>
          </button>
          {openMenu === "target" && (
            <div className="batch-select-menu">
              {isPositionMode(scanMode)
                ? POS_OPTIONS.map((item) => (
                    <button key={item.value} type="button" className={item.value === targetPos ? "batch-select-option active" : "batch-select-option"} onClick={() => { onTargetPosChange(item.value); setOpenMenu(null); }}>
                      <span>{item.label}</span>
                      {item.value === targetPos && <b>✓</b>}
                    </button>
                  ))
                : is3DMode(scanMode)
                  ? TARGET_3D_OPTIONS.map((item) => (
                      <button key={item.value} type="button" className={item.value === target3D ? "batch-select-option active" : "batch-select-option"} onClick={() => { onTarget3DChange(item.value); setOpenMenu(null); }}>
                        <span>{item.label}</span>
                        {item.value === target3D && <b>✓</b>}
                      </button>
                    ))
                  : TARGET_2D_OPTIONS.map((item) => (
                      <button key={item.value} type="button" className={item.value === target2D ? "batch-select-option active" : "batch-select-option"} onClick={() => { onTarget2DChange(item.value); setOpenMenu(null); }}>
                        <span>{item.label}</span>
                        {item.value === target2D && <b>✓</b>}
                      </button>
                    ))}
            </div>
          )}
        </div>
        <div className="batch-field batch-dropdown-field">
          <label>{isOffMode(scanMode) ? (isShioMode(scanMode) ? "Jumlah OFF Shio" : "Jumlah OFF") : (isShioMode(scanMode) ? "Jumlah Shio" : "Jumlah Digit")}</label>
          <button className="batch-select-btn" type="button" onClick={() => toggle("digit")}>
            <b>{digitLabel}</b>
            <span>{openMenu === "digit" ? "⌃" : "⌄"}</span>
          </button>
          {openMenu === "digit" && (
            <div className="batch-select-menu">
              {DIGIT_OPTIONS.filter((value) => isShioMode(scanMode) || value <= 9).map((value) => {
                const label = `${value} ${isShioMode(scanMode) ? "shio" : "digit"}`;
                return (
                  <button key={value} type="button" className={value === digitCount ? "batch-select-option active" : "batch-select-option"} onClick={() => { onDigitCountChange(value); setOpenMenu(null); }}>
                    <span>{label}</span>
                    {value === digitCount && <b>✓</b>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}