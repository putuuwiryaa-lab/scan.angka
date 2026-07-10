import type { EchoWindowAudit } from "../../../lib/echo/types";
import styles from "../echo.module.css";

export default function EchoWindowList({ windows }: { windows: EchoWindowAudit[] }) {
  return (
    <div className={styles.windowList}>
      {windows.map((window) => (
        <article className={styles.windowRow} key={window.window}>
          <div>
            <b>L{window.window}</b>
            <small>bobot {Math.round(window.weight * 100)}%</small>
          </div>
          <span>{window.hit}/{window.total}</span>
          <strong>{window.rate}%</strong>
          <small>miss maks. {window.longestMissStreak}</small>
        </article>
      ))}
    </div>
  );
}
