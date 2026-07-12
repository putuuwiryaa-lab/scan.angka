import { useState } from "react";
import {
  ADAPTIVE_BATCH_OPTIONS,
  adaptiveTargetKind,
  batchModeUsesFixedTarget,
  isAdaptiveBatchMode,
  minimumAdaptiveDigitCount,
  type BatchAnalysisMode,
} from "../../../lib/shared/batch-analysis";
import { ANALYSIS_OPTIONS, DIGIT_OPTIONS, POS_OPTIONS, TARGET_2D_OPTIONS, TARGET_3D_OPTIONS } from "../../shared/scan-options";
import { cleanDigits, clampTextNumber, is3DMode, isOffMode, isPositionMode, isShioMode } from "../../shared/scan-utils";
import type { Posisi, ScanMode, Target2D, Target3D } from "../../shared/types";

type Props = {
  rounds: string;
  scanMode: BatchAnalysisMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  topRanks: number[];
  outputSeparator: string;
  secondaryScanMode: BatchAnalysisMode | "";
  secondaryRounds: string;
  secondaryTargetPos: Posisi;
  secondaryTarget2D: Target2D;
  secondaryTarget3D: Target3D;
  secondaryDigitCount: number;
  secondaryTopRanks: number[];
  onRoundsChange: (value: string) => void;
  onScanModeChange: (value: BatchAnalysisMode) => void;
  onTargetPosChange: (value: Posisi) => void;
  onTarget2DChange: (value: Target2D) => void;
  onTarget3DChange: (value: Target3D) => void;
  onDigitCountChange: (value: number) => void;
  onTopRanksChange: (value: number[]) => void;
  onOutputSeparatorChange: (value: string) => void;
  onSecondaryScanModeChange: (value: BatchAnalysisMode | "") => void;
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
const BATCH_ANALYSIS_OPTIONS: { value: BatchAnalysisMode; label: string }[] = [
  ...ADAPTIVE_BATCH_OPTIONS,
  ...ANALYSIS_OPTIONS,
];

function optionLabel<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((item) => item.value === value)?.label ?? value;
}

function asLegacyMode(mode: BatchAnalysisMode): ScanMode | null {
  return isAdaptiveBatchMode(mode) ? null : mode;
}

function targetLabel(mode: BatchAnalysisMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D): string {
  if (isAdaptiveBatchMode(mode)) {
    const kind = adaptiveTargetKind(mode);
    if (kind === "position") return optionLabel(POS_OPTIONS, targetPos);
    if (kind === "3d") return optionLabel(TARGET_3D_OPTIONS, target3D);
    if (kind === "4d") return "AS + COP + KPL + EKR";
    return optionLabel(TARGET_2D_OPTIONS, target2D);
  }

  return isPositionMode(mode)
    ? optionLabel(POS_OPTIONS, targetPos)
    : is3DMode(mode)
      ? optionLabel(TARGET_3D_OPTIONS, target3D)
      : optionLabel(TARGET_2D_OPTIONS, target2D);
}

function digitLabel(mode: BatchAnalysisMode, digitCount: number): string {
  const legacy = asLegacyMode(mode);
  return `${digitCount} ${legacy && isShioMode(legacy) ? "shio" : "digit"}`;
}

function digitFieldLabel(mode: BatchAnalysisMode): string {
  if (isAdaptiveBatchMode(mode)) return "Cakupan Digit";
  if (isOffMode(mode)) return isShioMode(mode) ? "OFF Shio" : "Jumlah OFF";
  return isShioMode(mode) ? "Jumlah Shio" : "Jumlah Digit";
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

  function renderModeSelector(
    method: "m1" | "m2",
    mode: BatchAnalysisMode | "",
    onMode: (value: BatchAnalysisMode | "") => void,
    allowDisabled: boolean,
  ) {
    const menuKey = method === "m1" ? "m1Jenis" : "m2Jenis";
    return (
      <div className="batch-field batch-dropdown-field">
        <label>Jenis Analisis</label>
        <button className="batch-select-btn" type="button" onClick={() => toggle(menuKey)}>
          <b>{mode ? optionLabel(BATCH_ANALYSIS_OPTIONS, mode) : "Tidak dipakai"}</b>
          <span>{openMenu === menuKey ? "⌃" : "⌄"}</span>
        </button>
        {openMenu === menuKey && (
          <div className="batch-select-menu">
            {allowDisabled && (
              <button type="button" className={mode === "" ? "batch-select-option active" : "batch-select-option"} onClick={() => { onMode(""); setOpenMenu(null); }}>
                <span>Tidak dipakai</span>
                {mode === "" && <b>✓</b>}
              </button>
            )}
            {BATCH_ANALYSIS_OPTIONS.map((item) => (
              <button key={item.value} type="button" className={item.value === mode ? "batch-select-option active" : "batch-select-option"} onClick={() => { onMode(item.value); setOpenMenu(null); }}>
                <span>{item.label}</span>
                {item.value === mode && <b>✓</b>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderTargetMenu(
    method: "m1" | "m2",
    mode: BatchAnalysisMode,
    selectedPos: Posisi,
    selected2D: Target2D,
    selected3D: Target3D,
    onPos: (value: Posisi) => void,
    on2D: (value: Target2D) => void,
    on3D: (value: Target3D) => void,
  ) {
    const menuKey = method === "m1" ? "m1Target" : "m2Target";
    if (openMenu !== menuKey || batchModeUsesFixedTarget(mode)) return null;

    const adaptiveKind = isAdaptiveBatchMode(mode) ? adaptiveTargetKind(mode) : null;
    const usePosition = adaptiveKind === "position" || (!adaptiveKind && isPositionMode(mode as ScanMode));
    const use3D = adaptiveKind === "3d" || (!adaptiveKind && is3DMode(mode as ScanMode));

    return (
      <div className="batch-select-menu">
        {usePosition
          ? POS_OPTIONS.map((item) => (
              <button key={item.value} type="button" className={item.value === selectedPos ? "batch-select-option active" : "batch-select-option"} onClick={() => { onPos(item.value); setOpenMenu(null); }}>
                <span>{item.label}</span>
                {item.value === selectedPos && <b>✓</b>}
              </button>
            ))
          : use3D
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

  function renderDigitMenu(method: "m1" | "m2", mode: BatchAnalysisMode, selectedDigit: number, onDigit: (value: number) => void) {
    const menuKey = method === "m1" ? "m1Digit" : "m2Digit";
    if (openMenu !== menuKey) return null;

    const adaptive = isAdaptiveBatchMode(mode);
    const legacy = asLegacyMode(mode);
    const minimum = adaptive ? minimumAdaptiveDigitCount(mode) : 1;
    const maximum = legacy && isShioMode(legacy) ? 12 : 9;

    return (
      <div className="batch-select-menu">
        {DIGIT_OPTIONS.filter((value) => value >= minimum && value <= maximum).map((value) => {
          const label = `${value} ${legacy && isShioMode(legacy) ? "shio" : "digit"}`;
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

  function renderMethodFields(
    method: "m1" | "m2",
    mode: BatchAnalysisMode,
    methodRounds: string,
    selectedPos: Posisi,
    selected2D: Target2D,
    selected3D: Target3D,
    selectedDigit: number,
    selectedRanks: number[],
    onRounds: (value: string) => void,
    onPos: (value: Posisi) => void,
    on2D: (value: Target2D) => void,
    on3D: (value: Target3D) => void,
    onDigit: (value: number) => void,
    onRanks: (value: number[]) => void,
  ) {
    const adaptive = isAdaptiveBatchMode(mode);
    const targetMenu = method === "m1" ? "m1Target" : "m2Target";
    const digitMenu = method === "m1" ? "m1Digit" : "m2Digit";

    return (
      <>
        {!adaptive && (
          <div className="batch-field">
            <label>Data Uji</label>
            <input className="batch-input" inputMode="numeric" value={methodRounds} onChange={(event) => onRounds(cleanDigits(event.target.value, 3))} onBlur={() => onRounds(String(clampTextNumber(methodRounds, 14, 1, 100)))} />
          </div>
        )}

        {adaptive && (
          <div className="batch-notice">Turnamen model otomatis · Walk-forward L14 · rekomendasi hanya diterbitkan jika lolos validasi.</div>
        )}

        <div className="batch-row-two">
          <div className="batch-field batch-dropdown-field">
            <label>Target</label>
            <button className="batch-select-btn" type="button" disabled={batchModeUsesFixedTarget(mode)} onClick={() => toggle(targetMenu)}>
              <b>{targetLabel(mode, selectedPos, selected2D, selected3D)}</b>
              {!batchModeUsesFixedTarget(mode) && <span>{openMenu === targetMenu ? "⌃" : "⌄"}</span>}
            </button>
            {renderTargetMenu(method, mode, selectedPos, selected2D, selected3D, onPos, on2D, on3D)}
          </div>
          <div className="batch-field batch-dropdown-field">
            <label>{digitFieldLabel(mode)}</label>
            <button className="batch-select-btn" type="button" onClick={() => toggle(digitMenu)}>
              <b>{digitLabel(mode, selectedDigit)}</b>
              <span>{openMenu === digitMenu ? "⌃" : "⌄"}</span>
            </button>
            {renderDigitMenu(method, mode, selectedDigit, onDigit)}
          </div>
        </div>

        {!adaptive && (
          <div className="batch-field">
            <label>Pilih Top Output</label>
            {renderTopCards(selectedRanks, onRanks)}
          </div>
        )}
      </>
    );
  }

  function renderSeparatorCards() {
    return (
      <div className="batch-top-grid">
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
          {renderModeSelector("m1", scanMode, (value) => value && onScanModeChange(value), false)}
          {renderMethodFields(
            "m1",
            scanMode,
            rounds,
            targetPos,
            target2D,
            target3D,
            digitCount,
            topRanks,
            onRoundsChange,
            onTargetPosChange,
            onTarget2DChange,
            onTarget3DChange,
            onDigitCountChange,
            onTopRanksChange,
          )}
        </div>

        <div className={secondaryActive ? "batch-method-card" : "batch-method-card inactive"}>
          <div className="batch-method-title">Metode 2</div>
          {renderModeSelector("m2", secondaryScanMode, onSecondaryScanModeChange, true)}
          {secondaryActive && secondaryScanMode && renderMethodFields(
            "m2",
            secondaryScanMode,
            secondaryRounds,
            secondaryTargetPos,
            secondaryTarget2D,
            secondaryTarget3D,
            secondaryDigitCount,
            secondaryTopRanks,
            onSecondaryRoundsChange,
            onSecondaryTargetPosChange,
            onSecondaryTarget2DChange,
            onSecondaryTarget3DChange,
            onSecondaryDigitCountChange,
            onSecondaryTopRanksChange,
          )}
        </div>
      </div>

      <div className="batch-method-card" style={{ marginTop: 10 }}>
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
