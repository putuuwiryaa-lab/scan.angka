import { isShioMode } from "../../shared/scan-utils";
import { labelsFromValues } from "../helpers";
import type { ScanResult } from "../types";

type Props = {
  result: ScanResult | null;
};

type FrequencyItem = {
  value: number;
  label: string;
  count: number;
};

function buildFrequency(result: ScanResult): FrequencyItem[] {
  const maxValue = isShioMode(result.config.scanMode) ? 12 : 10;
  const counts = Array.from({ length: maxValue }, () => 0);

  for (const item of result.items) {
    for (const value of item.angkaHidup) {
      if (value >= 0 && value < counts.length) counts[value] += 1;
    }
  }

  return counts
    .map((count, value) => ({ value, label: labelsFromValues([value], result.config.scanMode)[0], count }))
    .sort((a, b) => b.count - a.count || a.value - b.value);
}

export default function ScanFrequencyPanel({ result }: Props) {
  if (!result || result.items.length === 0) return null;

  const items = buildFrequency(result);
  const unit = isShioMode(result.config.scanMode) ? "shio" : "digit";

  return (
    <div className="frequency-block">
      <div className="frequency-head">
        <b>Frekuensi Hasil Scan</b>
        <span>{result.items.length} trek</span>
      </div>
      <p>Hitungan dari {unit} hidup pada hasil scan yang sedang tampil.</p>
      <div className="frequency-grid">
        {items.map((item) => (
          <div className={item.count === 0 ? "frequency-item muted" : "frequency-item"} key={item.value}>
            <b>{item.label}</b>
            <i>{item.count}×</i>
            <span>{item.count > 0 ? `muncul di ${item.count} trek` : "tidak muncul"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}