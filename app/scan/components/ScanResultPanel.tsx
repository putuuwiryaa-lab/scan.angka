import { ROW_ACTIONS_STYLE } from "../constants";
import { isShioMode } from "../../shared/scan-utils";
import { analysisTitle, labelValue, labelsFromValues, savedSignature } from "../helpers";
import type { ScanItem, ScanResult } from "../types";

type Props = {
  result: ScanResult;
  marketName: string;
  marketId: string;
  savedFlashId: string;
  onSave: (item: ScanItem) => void;
  onView: (item: ScanItem) => void;
};

type FrequencyRow = {
  value: number;
  label: string;
  count: number;
};

function buildFrequencyRows(result: ScanResult): FrequencyRow[] {
  const maxValue = isShioMode(result.config.scanMode) ? 12 : 10;
  const counts = Array.from({ length: maxValue }, () => 0);

  for (const item of result.items) {
    for (const value of item.angkaHidup) {
      if (Number.isInteger(value) && value >= 0 && value < counts.length) {
        counts[value] += 1;
      }
    }
  }

  return counts
    .map((count, value) => ({
      value,
      label: labelValue(value, result.config.scanMode),
      count,
    }))
    .sort((left, right) => right.count - left.count || left.value - right.value);
}

export default function ScanResultPanel({ result, marketName, marketId, savedFlashId, onSave, onView }: Props) {
  const frequencyRows = buildFrequencyRows(result);
  const unitLabel = isShioMode(result.config.scanMode) ? "Shio" : "Digit";

  return (
    <div className="panel result-panel">
      <p className="summary">
        <b>{marketName}</b> &middot; <b>{analysisTitle(result.config.scanMode, result.config.targetPos, result.config.target2D, result.config.target3D)}</b> &middot; {result.config.digitCount} {isShioMode(result.config.scanMode) ? "shio" : "digit"} &middot; {result.config.L} data &middot; {result.totalMatched} hasil
      </p>
      <div className="scan-list compact-list">
        {result.items.length === 0 && <div className="scan-empty">Belum ada trek yang cocok.</div>}
        {result.items.map((item, index) => {
          const signature = savedSignature(item, marketId);
          return (
            <div className={`scan-item compact role-${index + 1}`} key={`${item.scanMode}-${item.targetPos}-${item.target2D}-${item.target3D}-${item.formula}-${index}`}>
              <div className="scan-row-body">
                <span className={`scan-formula compact-formula role-${index + 1}`}>{item.formula}</span>
                <div className="compact-digits">
                  {labelsFromValues(item.angkaHidup, item.scanMode).map((digit, digitIndex) => <span key={`${digit}-${digitIndex}`}>{digit}</span>)}
                </div>
                <div className="scan-actions" style={ROW_ACTIONS_STYLE}>
                  <button className="view-btn compact-view" type="button" onClick={() => onSave(item)}>{savedFlashId === signature ? "Tersimpan" : "Simpan"}</button>
                  <button className="view-btn compact-view" type="button" onClick={() => onView(item)}>Lihat</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {result.items.length > 0 && (
        <div className="frequency-block">
          <div className="frequency-head">
            <b>Frekuensi {unitLabel}</b>
            <span>{result.items.length} hasil scan</span>
          </div>
          <p>Dihitung dari semua angka hidup yang tampil pada hasil scan.</p>
          <div className="frequency-grid">
            {frequencyRows.map((row) => (
              <div className={`frequency-item${row.count === 0 ? " muted" : ""}`} key={row.value}>
                <b>{row.label}</b>
                <i>×</i>
                <span>{row.count} kali muncul</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
