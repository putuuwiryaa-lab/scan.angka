import type { EchoNeighbor } from "../../../lib/echo/types";
import { regimeLabel } from "../presentation";
import styles from "../echo-result.module.css";

export default function EchoNeighborList({ neighbors }: { neighbors: EchoNeighbor[] }) {
  return (
    <div className={styles.compactList}>
      {neighbors.map((neighbor, index) => (
        <article className={styles.neighborRow} key={`${neighbor.anchorIndex}-${index}`}>
          <span className={styles.rowIndex}>{index + 1}</span>
          <div className={styles.rowMain}>
            <b>{neighbor.anchorDraw} ➜ {neighbor.nextDraw}</b>
            <small>{regimeLabel(neighbor.regime)}</small>
          </div>
          <span className={styles.delta}>Perubahan {neighbor.movement > 0 ? "+" : ""}{neighbor.movement}</span>
          <small className={styles.distance}>Jarak {neighbor.distance.toFixed(3)}</small>
        </article>
      ))}
    </div>
  );
}
