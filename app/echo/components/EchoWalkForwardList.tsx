import type { EchoAuditPhase, EchoBacktestRow } from "../../../lib/echo/types";
import styles from "../echo-result.module.css";

const PHASE_LABEL: Record<EchoAuditPhase, string> = {
  discovery: "D",
  validation: "V",
  holdout: "H",
};

export default function EchoWalkForwardList({ rows }: { rows: EchoBacktestRow[] }) {
  return (
    <div className={styles.compactList}>
      {rows.map((row, index) => (
        <article className={styles.auditRow} key={`${row.targetIndex}-${index}`}>
          <span className={styles.rowIndex}>{PHASE_LABEL[row.phase]}</span>
          <div className={styles.rowMain}>
            <b>{row.displayDraw} ➜ {row.targetDraw}</b>
            <small>#{index + 1} · Patokan {row.patokan} · confidence {row.confidence}</small>
          </div>
          <strong className={row.covered ? styles.hit : styles.miss}>{row.covered ? "✓" : "×"}</strong>
        </article>
      ))}
    </div>
  );
}
