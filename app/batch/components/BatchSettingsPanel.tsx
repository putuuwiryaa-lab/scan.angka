import { ANALYSIS_OPTIONS, DIGIT_OPTIONS, POS_OPTIONS, TARGET_2D_OPTIONS } from "../../scan/constants";
import { cleanDigits, clampTextNumber, isOffMode, isPositionMode, isShioMode } from "../../scan/helpers";
import type { Posisi, ScanMode, Target2D } from "../../scan/types";

type Props = {
  rounds: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  digitCount: number;
  onRoundsChange: (value: string) => void;
  onScanModeChange: (value: ScanMode) => void;
  onTargetPosChange: (value: Posisi) => void;
  onTarget2DChange: (value: Target2D) => void;
  onDigitCountChange: (value: number) => void;
};

export default function BatchSettingsPanel({
  rounds,
  scanMode,
  targetPos,
  target2D,
  digitCount,
  onRoundsChange,
  onScanModeChange,
  onTargetPosChange,
  onTarget2DChange,
  onDigitCountChange,
}: Props) {
  return (
    <section className="batch-panel">
      <div className="batch-row-two">
        <div className="batch-field">
          <label>Data Uji</label>
          <input className="batch-input" inputMode="numeric" value={rounds} onChange={(event) => onRoundsChange(cleanDigits(event.target.value, 3))} onBlur={() => onRoundsChange(String(clampTextNumber(rounds, 14, 1, 100)))} />
        </div>
        <div className="batch-field">
          <label>Jenis</label>
          <select className="batch-select" value={scanMode} onChange={(event) => onScanModeChange(event.target.value as ScanMode)}>
            {ANALYSIS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      <div className="batch-row-two">
        <div className="batch-field">
          <label>Target</label>
          {isPositionMode(scanMode) ? (
            <select className="batch-select" value={targetPos} onChange={(event) => onTargetPosChange(event.target.value as Posisi)}>
              {POS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          ) : (
            <select className="batch-select" value={target2D} onChange={(event) => onTarget2DChange(event.target.value as Target2D)}>
              {TARGET_2D_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          )}
        </div>
        <div className="batch-field">
          <label>{isOffMode(scanMode) ? (isShioMode(scanMode) ? "Jumlah OFF Shio" : "Jumlah OFF") : (isShioMode(scanMode) ? "Jumlah Shio" : "Jumlah Digit")}</label>
          <select className="batch-select" value={digitCount} onChange={(event) => onDigitCountChange(Number(event.target.value))}>
            {DIGIT_OPTIONS.filter((value) => isShioMode(scanMode) || value <= 9).map((value) => <option key={value} value={value}>{value} {isShioMode(scanMode) ? "shio" : "digit"}</option>)}
          </select>
        </div>
      </div>
    </section>
  );
}
