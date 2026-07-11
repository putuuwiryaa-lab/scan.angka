import type { EchoAuditPhase, EchoBacktestRow } from "../../../lib/echo/types";
import styles from "../echo-result.module.css";

const PHASE_LABEL: Record<EchoAuditPhase, string> = {
  discovery: "A",
  validation: "U",
  holdout: "V",
};

export default function EchoWalkForwardList({ rows }: { rows: EchoBacktestRow[] }) {
  return (
    <div className={styles.compactList}>
      {rows.map((row, index) => (
        <article className={styles.auditRow} key={`${row.targetIndex}-${index}`}>
          <span className={styles.rowIndex}>{PHASE_LABEL[row.phase]}</span>
          <div className={styles.rowMain}>
            <b>{row.displayDraw} ➜ {row.targetDraw}</b>
            <small>Pengujian {index + 1} · angka acuan {row.patokan} · keyakinan {row.confidence}</small>
          </div>
          <strong className={row.covered ? styles.hit : styles.miss}>{row.covered ? "✓" : "×"}</strong>
        </article>
      ))}
    </div>
  );
}
