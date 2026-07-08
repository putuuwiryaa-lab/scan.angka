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
  topRanks: number[];
  outputSeparator: string;
  secondaryScanMode: ScanMode | "";
  secondaryRounds: string;
  secondaryTargetPos: Posisi;
  secondaryTarget2D: Target2D;
  secondaryTarget3D: Target3D;
  secondaryDigitCount: number;
  secondaryTopRanks: number[];
  onRoundsChange: (value: string) => void;
  onScanModeChange: (value: ScanMode) => void;
  onTargetPosChange: (value: Posisi) => void;
  onTarget2DChange: (value: Target2D) => void;
  onTarget3DChange: (value: Target3D) => void;
  onDigitCountChange: (value: number) => void;
  onTopRanksChange: (value: number[]) => void;
  onOutputSeparatorChange: (value: string) => void;
  onSecondaryScanModeChange: (value: ScanMode | "") => void;
  onSecondaryRoundsChange: (value: string) => void;
  onSecondaryTargetPosChange: (value: Posisi) => void;
  onSecondaryTarget2DChange: (value: Target2D) => void;
  onSecondaryTarget3DChange: (value: Target3D) => void;
  onSecondaryDigitCountChange: (value: number) => void;
  onSecondaryTopRanksChange: (value: number[]) => void;
};

type OpenMenu = "m1Jenis" | "m1Target" | "m1Digit" | "m2Jenis" | "m2Target" | "m2Digit" | null;

const TOP_OPTIONS = [1, 2, 3];
const DEFAULT_SEPARATOR = "➜";
const SEPARATOR_OPTIONS = ["➜", "⟢", "-", ":", "•", "➡️", "✅", "🎯", "🔥"];

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

function normalizeRanks(ranks: number[]): number[] {
  const next = [...new Set(ranks.filter((rank) => TOP_OPTIONS.includes(rank)))].sort((a, b) => a - b);
  return next.length ? next : [1];
}

function toggleRank(ranks: number[], rank: number): number[] {
  const exists = ranks.includes(rank);
  if (exists && ranks.length === 1) return ranks;
  return normalizeRanks(exists ? ranks.filter((item) => item !== rank) : [...ranks, rank]);
}

function cleanSeparator(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 16);
}

function activeSeparator(value: string): string {
  return value.trim() || DEFAULT_SEPARATOR;
}

export default function BatchSettingsPanel({
  rounds,
  scanMode,
  targetPos,
  target2D,
  target3D,
  digitCount,
  topRanks,
  outputSeparator,
  secondaryScanMode,
  secondaryRounds,
  secondaryTargetPos,
  secondaryTarget2D,
  secondaryTarget3D,
  secondaryDigitCount,
  secondaryTopRanks,
  onRoundsChange,
  onScanModeChange,
  onTargetPosChange,
  onTarget2DChange,
  onTarget3DChange,
  onDigitCountChange,
  onTopRanksChange,
  onOutputSeparatorChange,
  onSecondaryScanModeChange,
  onSecondaryRoundsChange,
  onSecondaryTargetPosChange,
  onSecondaryTarget2DChange,
  onSecondaryTarget3DChange,
  onSecondaryDigitCountChange,
  onSecondaryTopRanksChange,
}: Props) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const secondaryActive = Boolean(secondaryScanMode);
  const selectedSeparator = activeSeparator(outputSeparator);

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

  function renderTopCards(ranks: number[], onChange: (value: number[]) => void) {
    return (
      <div className="batch-top-grid">
        {TOP_OPTIONS.map((rank) => {
          const active = ranks.includes(rank);
          return (
            <button key={rank} type="button" className={active ? "batch-top-card active" : "batch-top-card"} onClick={() => onChange(toggleRank(ranks, rank))}>
              <span className="batch-top-check">{active ? "✓" : ""}</span>
              <b>Top {rank}</b>
            </button>
          );
        })}
      </div>
    );
  }

  function renderSeparatorCards() {
    return (
      <div className="batch-separator-grid">
        {SEPARATOR_OPTIONS.map((separator) => {
          const active = selectedSeparator === separator;
          return (
            <button key={separator} type="button" className={active ? "batch-top-card active" : "batch-top-card"} onClick={() => onOutputSeparatorChange(separator)}>
              <span className="batch-top-check">{active ? "✓" : ""}</span>
              <b>{separator}</b>
            </button>
          );
        })}
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
          <div className="batch-field">
            <label>Pilih Top Output</label>
            {renderTopCards(topRanks, onTopRanksChange)}
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
              <div className="batch-field">
                <label>Pilih Top Output</label>
                {renderTopCards(secondaryTopRanks, onSecondaryTopRanksChange)}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="batch-method-card batch-separator-card">
        <div className="batch-method-title">Format Copy</div>
        <div className="batch-field">
          <label>Separator Nama & Prediksi</label>
          {renderSeparatorCards()}
        </div>
        <div className="batch-field">
          <label>Custom dari Keyboard</label>
          <input className="batch-input" value={outputSeparator} maxLength={16} placeholder="Contoh: ⟢ / 🎯 / :" onChange={(event) => onOutputSeparatorChange(cleanSeparator(event.target.value))} />
          <div className="batch-notice">Preview: Nama Pasaran {selectedSeparator} Prediksi</div>
        </div>
      </div>
    </section>
  );
}
