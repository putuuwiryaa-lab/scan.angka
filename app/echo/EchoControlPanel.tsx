import {
  ANALYSIS_LABEL,
  ANALYSIS_OPTIONS,
  DIGIT_OPTIONS,
  POS_OPTIONS,
  TARGET_2D_OPTIONS,
  TARGET_3D_OPTIONS,
} from "../scan/constants";
import { is3DMode, isOffMode, isPositionMode, isShioMode, marketTitle } from "../shared/scan-utils";
import type { Market, Posisi, ScanMode, Target2D, Target3D } from "../scan/types";
import EchoSelectSheet, { type EchoSheetOption } from "./components/EchoSelectSheet";
import styles from "./echo.module.css";

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

type FieldButtonProps = {
  label: string;
  value: string;
  hint?: string;
  onClick: () => void;
};

function FieldButton({ label, value, hint, onClick }: FieldButtonProps) {
  return (
    <div className={styles.controlField}>
      <span className={styles.controlLabel}>{label}</span>
      <button className={styles.fieldButton} type="button" onClick={onClick}>
        <span className={styles.fieldButtonText}>
          <b>{value}</b>
          {hint && <small>{hint}</small>}
        </span>
        <span className={styles.fieldChevron} aria-hidden="true">›</span>
      </button>
    </div>
  );
}

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
  const marketOptions: EchoSheetOption[] = filteredMarkets.map((market) => ({
    value: market.id,
    label: marketTitle(market),
    secondary: market.latestResult ? `Keluaran terakhir: ${market.latestResult}` : undefined,
  }));

  const analysisOptions: EchoSheetOption[] = ANALYSIS_OPTIONS.map((item) => ({
    value: item.value,
    label: item.label,
  }));

  const targetOptions: EchoSheetOption[] = isPositionMode(scanMode)
    ? POS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))
    : is3DMode(scanMode)
      ? TARGET_3D_OPTIONS.map((item) => ({ value: item.value, label: item.label }))
      : TARGET_2D_OPTIONS.map((item) => ({ value: item.value, label: item.label }));

  const selectedTarget = isPositionMode(scanMode) ? targetPos : is3DMode(scanMode) ? target3D : target2D;
  const digitLabel = isOffMode(scanMode)
    ? isShioMode(scanMode) ? "Jumlah Shio yang Dihilangkan" : "Jumlah Digit yang Dihilangkan"
    : isShioMode(scanMode) ? "Jumlah Shio" : "Jumlah Digit";
  const digitUnit = isShioMode(scanMode) ? "shio" : "digit";
  const digitOptions: EchoSheetOption[] = DIGIT_OPTIONS
    .filter((value) => isShioMode(scanMode) || value <= 9)
    .map((value) => ({ value, label: `${value} ${digitUnit}` }));

  function selectMarketById(value: string | number) {
    const market = filteredMarkets.find((item) => item.id === String(value));
    if (market) onSelectMarket(market);
  }

  function selectTarget(value: string | number) {
    const target = String(value);
    if (isPositionMode(scanMode)) onSelectTargetPos(target as Posisi);
    else if (is3DMode(scanMode)) onSelectTarget3D(target as Target3D);
    else onSelectTarget2D(target as Target2D);
  }

  return (
    <>
      <section className={`panel ${styles.controlPanel}`} aria-label="Pengaturan analisa Echo">
        <div className={styles.controlIntro}>
          <div>
            <span>PENGATURAN ANALISA</span>
            <b>Sesuaikan kebutuhan analisa</b>
          </div>
          <small>4 pilihan</small>
        </div>

        <FieldButton
          label="Pasaran"
          value={selectedMarket ? marketTitle(selectedMarket) : "Pilih pasaran"}
          hint={selectedMarket?.latestResult ? `Keluaran terakhir: ${selectedMarket.latestResult}` : "Pasaran wajib dipilih"}
          onClick={onOpenMarket}
        />

        <div className={styles.controlGrid}>
          <FieldButton label="Jenis Analisa" value={ANALYSIS_LABEL[scanMode]} onClick={onToggleJenis} />
          <FieldButton label="Target Analisa" value={targetText} onClick={onToggleTarget} />
        </div>

        <FieldButton label={digitLabel} value={`${digitCount} ${digitUnit}`} onClick={onToggleDigit} />

        <div className={styles.auditStrip}>
          <span className={styles.auditDot} aria-hidden="true" />
          <div>
            <b>Evaluasi otomatis aktif</b>
            <small>Rekomendasi dipilih dari riwayat, diuji secara berurutan, lalu diverifikasi pada data terbaru.</small>
          </div>
        </div>

        <button className={styles.runButton} onClick={onRun} disabled={loading || !marketId}>
          {loading ? <span className={styles.loadingSpinner} aria-hidden="true" /> : null}
          <span>{loading ? "Sedang menganalisa data..." : "Mulai Analisa Echo"}</span>
        </button>
        {error && <div className={styles.errorBox}>{error}</div>}
      </section>

      <EchoSelectSheet
        open={marketOpen}
        title="Pilih Pasaran"
        options={marketOptions}
        selectedValue={marketId}
        searchValue={marketQuery}
        searchPlaceholder="Cari pasaran..."
        onSearchChange={onMarketQueryChange}
        onSelect={selectMarketById}
        onClose={onCloseMarket}
        emptyText="Pasaran tidak ditemukan"
      />

      <EchoSelectSheet
        open={jenisOpen}
        title="Pilih Jenis Analisa"
        options={analysisOptions}
        selectedValue={scanMode}
        onSelect={(value) => onSelectJenis(String(value) as ScanMode)}
        onClose={onCloseMarket}
      />

      <EchoSelectSheet
        open={targetOpen}
        title="Pilih Target Analisa"
        options={targetOptions}
        selectedValue={selectedTarget}
        onSelect={selectTarget}
        onClose={onCloseMarket}
      />

      <EchoSelectSheet
        open={digitOpen}
        title={digitLabel}
        options={digitOptions}
        selectedValue={digitCount}
        onSelect={(value) => onSelectDigit(Number(value))}
        onClose={onCloseMarket}
      />
    </>
  );
}
