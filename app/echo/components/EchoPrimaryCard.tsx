import { analysisTitle, labelsFromValues } from "../../scan/helpers";
import type { EchoItem } from "../../../lib/echo/types";
import { buildEchoCopyText, profileTitle } from "../presentation";
import styles from "../echo.module.css";

export default function EchoPrimaryCard({ item, marketName }: { item: EchoItem; marketName: string }) {
  const digits = labelsFromValues(item.angkaHidup, item.scanMode);

  async function handleCopy() {
    await navigator.clipboard.writeText(buildEchoCopyText(item, marketName));
  }

  return (
    <section className={`${styles.panel} ${styles.primaryCard}`}>
      <div className={styles.primaryHead}>
        <div className={styles.primaryIdentity}>
          <span className={styles.eyebrow}>REKOMENDASI UTAMA</span>
          <h2>{profileTitle(item)}</h2>
          <code>{item.formula}</code>
        </div>
        <div className={`${styles.confidenceBadge} ${styles[item.confidenceLevel.toLowerCase()]}`}>
          <span>{item.confidenceLevel}</span>
          <strong>{item.confidence}</strong>
        </div>
      </div>

      <p className={styles.marketLine}>
        <b>{marketName}</b>
        <span>·</span>
        <span>{analysisTitle(item.scanMode, item.targetPos, item.target2D, item.target3D)}</span>
      </p>

      <div className={styles.mainDigits} aria-label="Angka rekomendasi">
        {digits.map((digit, index) => <span key={`${digit}-${index}`}>{digit}</span>)}
      </div>

      <div className={styles.chipRow}>
        <span>Skor {item.score}</span>
        <span>Validation {item.audit.validationHit}/{item.audit.validationTotal}</span>
        <span>Holdout {item.audit.holdoutHit}/{item.audit.holdoutTotal}</span>
        <span>Konsensus {item.familyAgreement}%</span>
      </div>

      <button className={styles.copyButton} type="button" onClick={handleCopy}>Salin Hasil</button>
    </section>
  );
}
