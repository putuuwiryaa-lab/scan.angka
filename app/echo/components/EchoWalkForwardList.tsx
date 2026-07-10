import type { EchoBacktestRow } from "../../../lib/echo/types";
import styles from "../echo.module.css";

export default function EchoWalkForwardList({ rows }: { rows: EchoBacktestRow[] }) {
  return (
    <div className={styles.compactList}>
      {rows.map((row, index) => (
        <article className={styles.auditRow} key={`${row.targetIndex}-${index}`}>
          <span className={styles.rowIndex}>{index + 1}</span>
          <div className={styles.rowMain}>
            <b>{row.displayDraw} ➜ {row.targetDraw}</b>
            <small>Patokan {row.patokan} · confidence {row.confidence}</small>
          </div>
          <strong className={row.covered ? styles.hit : styles.miss}>{row.covered ? "✓" : "×"}</strong>
        </article>
      ))}
    </div>
  );
}
