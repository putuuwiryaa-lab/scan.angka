import type { EchoWindowAudit } from "../../../lib/echo/types";
import styles from "../echo-result.module.css";

export default function EchoWindowList({ windows }: { windows: EchoWindowAudit[] }) {
  return (
    <div className={styles.windowList}>
      {windows.map((window) => (
        <article className={styles.windowRow} key={window.window}>
          <div>
            <b>L{window.window}</b>
            <small>Bobot penilaian {Math.round(window.weight * 100)}%</small>
          </div>
          <span>{window.hit}/{window.total} berhasil</span>
          <strong>{window.rate}%</strong>
          <small>Gagal beruntun maksimum {window.longestMissStreak}</small>
        </article>
      ))}
    </div>
  );
}
