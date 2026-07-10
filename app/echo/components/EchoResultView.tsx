import type { ReactNode } from "react";
import type { EchoItem } from "../../../lib/echo/types";
import { FAMILY_LABEL } from "../presentation";
import styles from "../echo.module.css";
import EchoNeighborList from "./EchoNeighborList";
import EchoPrimaryCard from "./EchoPrimaryCard";
import EchoStatGrid, { type EchoStat } from "./EchoStatGrid";
import EchoWalkForwardList from "./EchoWalkForwardList";
import EchoWindowList from "./EchoWindowList";

function liftTone(value: number): EchoStat["tone"] {
  if (value >= 5) return "positive";
  if (value < 0) return "warning";
  return "default";
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}%`;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <header className={styles.sectionHead}>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export default function EchoResultView({ item, marketName }: { item: EchoItem; marketName: string }) {
  const liveStats: EchoStat[] = [
    { label: "Result terakhir", value: item.result.latestDraw },
    { label: "Patokan Echo", value: String(item.result.patokan) },
    { label: "Kolom aktif", value: item.activeColumns },
    { label: "Kondisi live", value: item.echo.regime.split("_").join(" ") },
    { label: "Echo efektif", value: String(item.echo.effectiveNeighbors), helper: `${item.echo.neighborCount} analog terpilih` },
    { label: "Stabilitas ensemble", value: `${item.echo.ensembleStability}%` },
    { label: "Kesesuaian regime", value: `${item.echo.regimeAgreement}%` },
    { label: "Jarak rata-rata", value: String(item.echo.meanDistance) },
  ];

  const validationStats: EchoStat[] = [
    {
      label: "Discovery",
      value: `${item.audit.discoveryWeightedAccuracy}%`,
      helper: `baseline ${item.audit.discoveryBaselineRate}% · ${signed(item.audit.discoveryLift)}`,
      tone: liftTone(item.audit.discoveryLift),
    },
    {
      label: "Nested walk-forward",
      value: `${item.audit.walkForwardRate}%`,
      helper: `${item.audit.walkForwardHit}/${item.audit.walkForwardTotal} · baseline ${item.audit.walkForwardBaselineRate}% · ${signed(item.audit.walkForwardLift)}`,
      tone: liftTone(item.audit.walkForwardLift),
    },
    {
      label: "Final holdout",
      value: `${item.audit.holdoutRate}%`,
      helper: `${item.audit.holdoutHit}/${item.audit.holdoutTotal} · baseline ${item.audit.holdoutBaselineRate}% · ${signed(item.audit.holdoutLift)}`,
      tone: liftTone(item.audit.holdoutLift),
    },
    { label: "Recent final", value: `${item.audit.recentHit}/${item.audit.recentTotal}` },
    { label: "Stabilitas discovery", value: `${item.audit.discoveryWindowStability}%` },
    { label: "Miss terpanjang", value: String(item.audit.longestMissStreak) },
  ];

  return (
    <div className={styles.resultStack}>
      <EchoPrimaryCard item={item} marketName={marketName} />

      <Section title="Prediksi Live" subtitle="Kualitas kondisi saat ini dan analog yang membentuk patokan.">
        <EchoStatGrid items={liveStats} />
      </Section>

      <Section title="Validasi Objektif" subtitle="Discovery memilih kolom. Validation mengulang pemilihan hanya dari data sebelumnya pada setiap titik. Final holdout tidak ikut memilih profile.">
        <EchoStatGrid items={validationStats} />
      </Section>

      <Section title="Discovery Multi-Window" subtitle={`Window terkuat L${item.audit.strongestWindow} · terlemah L${item.audit.weakestWindow}`}>
        <EchoWindowList windows={item.audit.windows} />
      </Section>

      <Section title="Konsensus Antar-Keluarga" subtitle="Konsensus hanya informasi pendukung dan tidak digunakan untuk memilih profile.">
        <div className={styles.consensusCard}>
          <strong>{item.familyAgreement}%</strong>
          <div>
            <b>{item.strength}</b>
            <p>{item.consensusFamilies.map((family) => FAMILY_LABEL[family]).join(", ")}</p>
          </div>
        </div>
      </Section>

      <Section title="Analog Historis Terdekat" subtitle="Anchor berdekatan dibatasi agar satu periode tidak mendominasi.">
        <EchoNeighborList neighbors={item.result.neighbors} />
      </Section>

      <Section title="Audit Walk-Forward" subtitle="D = discovery, V = nested validation, H = final holdout yang dibekukan.">
        <EchoWalkForwardList rows={item.result.rows} />
      </Section>
    </div>
  );
}
