import { batchMarketTitle } from "../helpers";
import type { Market } from "../../shared/types";

type Props = {
  markets: Market[];
  selected: string[];
  query: string;
  loading: boolean;
  error: string;
  maxMarkets: number;
  adaptive: boolean;
  onQueryChange: (value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onToggleMarket: (id: string) => void;
  onRun: () => void;
};

export default function BatchMarketSelector({
  markets,
  selected,
  query,
  loading,
  error,
  maxMarkets,
  adaptive,
  onQueryChange,
  onSelectAll,
  onClear,
  onToggleMarket,
  onRun,
}: Props) {
  return (
    <section className="batch-panel">
      <div className="batch-tools">
        <button className="batch-small-btn" type="button" onClick={onSelectAll}>Pilih Semua</button>
        <button className="batch-small-btn" type="button" onClick={onClear}>Kosongkan</button>
        <span className="batch-small-btn batch-selected-count">{selected.length}/{maxMarkets} dipilih</span>
      </div>

      <input className="batch-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari pasaran..." />

      <div className="batch-market-grid">
        {markets.map((market) => {
          const active = selected.includes(market.id);
          return (
            <button key={market.id} type="button" onClick={() => onToggleMarket(market.id)} className={active ? "batch-market-chip active" : "batch-market-chip"}>
              {active && <span>✓</span>}
              {batchMarketTitle(market)}
            </button>
          );
        })}
      </div>

      <p className="batch-notice">
        {adaptive
          ? `Mode Adaptif menjalankan turnamen L14 penuh. Maksimal ${maxMarkets} pasaran per proses.`
          : `Batas aman: maksimal ${maxMarkets} pasaran per batch scan.`}
      </p>
      <button className="batch-run" type="button" onClick={onRun} disabled={loading || selected.length === 0}>
        {loading ? (adaptive ? "Mengevaluasi model..." : "Sedang batch scan...") : (adaptive ? "Jalankan Batch Adaptif" : "Batch Scan")}
      </button>
      {error && <div className="batch-error">{error}</div>}
    </section>
  );
}
