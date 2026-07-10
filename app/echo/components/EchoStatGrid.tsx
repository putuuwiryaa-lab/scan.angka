import styles from "../echo.module.css";

export type EchoStat = {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warning";
  helper?: string;
};

export default function EchoStatGrid({ items }: { items: EchoStat[] }) {
  return (
    <div className={styles.statGrid}>
      {items.map((item) => (
        <article className={styles.statCard} key={`${item.label}-${item.value}`}>
          <strong className={`${styles.statValue} ${item.tone ? styles[item.tone] : ""}`}>{item.value}</strong>
          <span className={styles.statLabel}>{item.label}</span>
          {item.helper && <small className={styles.statHelper}>{item.helper}</small>}
        </article>
      ))}
    </div>
  );
}
