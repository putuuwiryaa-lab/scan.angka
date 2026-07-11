import type { ReactNode } from "react";
import type { EchoItem } from "../../../lib/echo/types";
import { FAMILY_LABEL, regimeLabel } from "../presentation";
import styles from "../echo-result.module.css";
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

function differenceText(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}% dari acuan`;
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.panel}>
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
    { label: "Keluaran terakhir", value: item.result.latestDraw },
    { label: "Model terpilih", value: item.selectionKind === "ensemble" ? "Ensemble" : "Satu keluarga" },
    { label: "Angka acuan", value: String(item.result.patokan) },
    { label: "Kolom terpilih", value: item.activeColumns },
    { label: "Kondisi pola terkini", value: regimeLabel(item.echo.regime) },
    { label: "Pola pembanding efektif", value: String(item.echo.effectiveNeighbors), helper: `${item.echo.neighborCount} pola historis digunakan` },
    { label: "Konsistensi prediksi", value: `${item.echo.ensembleStability}%` },
    { label: "Kesesuaian kondisi", value: `${item.echo.regimeAgreement}%` },
    { label: "Jarak pola rata-rata", value: String(item.echo.meanDistance), helper: "Nilai lebih kecil menunjukkan pola yang lebih mirip" },
  ];

  const validationStats: EchoStat[] = [
    {
      label: "Evaluasi awal",
      value: `${item.audit.discoveryWeightedAccuracy}%`,
      helper: `Acuan normal ${item.audit.discoveryBaselineRate}% · ${differenceText(item.audit.discoveryLift)}`,
      tone: liftTone(item.audit.discoveryLift),
    },
    {
      label: "Uji berurutan",
      value: `${item.audit.walkForwardRate}%`,
      helper: `${item.audit.walkForwardHit}/${item.audit.walkForwardTotal} berhasil · acuan ${item.audit.walkForwardBaselineRate}% · ${differenceText(item.audit.walkForwardLift)}`,
      tone: liftTone(item.audit.walkForwardLift),
    },
    {
      label: "Verifikasi akhir",
      value: `${item.audit.holdoutRate}%`,
      helper: `${item.audit.holdoutHit}/${item.audit.holdoutTotal} berhasil · acuan ${item.audit.holdoutBaselineRate}% · ${differenceText(item.audit.holdoutLift)}`,
      tone: liftTone(item.audit.holdoutLift),
    },
    {
      label: "Bukti gabungan",
      value: `${item.release.combinedRate}%`,
      helper: `Acuan ${item.release.combinedBaselineRate}% · ${differenceText(item.release.combinedLift)}${item.release.softAccepted ? " · toleransi sampel pendek digunakan" : ""}`,
      tone: liftTone(item.release.combinedLift),
    },
    { label: "Performa 5 hasil terakhir", value: `${item.audit.recentHit}/${item.audit.recentTotal}` },
    { label: "Konsistensi evaluasi", value: `${item.audit.discoveryWindowStability}%` },
    { label: "Gagal beruntun terpanjang", value: String(item.audit.longestMissStreak) },
  ];

  return (
    <div className={styles.resultStack}>
      <nav className={styles.quickNav} aria-label="Navigasi hasil Echo">
        <a href="#echo-result">Rekomendasi</a>
        <a href="#echo-live">Kondisi</a>
        <a href="#echo-validation">Evaluasi</a>
        <a href="#echo-pattern">Periode</a>
        <a href="#echo-audit">Riwayat Uji</a>
      </nav>

      <EchoPrimaryCard item={item} marketName={marketName} />

      <Section id="echo-live" title="Kondisi Analisa Saat Ini" subtitle="Ringkasan pola dan data pembanding yang membentuk rekomendasi.">
        <EchoStatGrid items={liveStats} />
      </Section>

      <Section id="echo-validation" title="Hasil Evaluasi" subtitle="Rekomendasi diuji secara berurutan dan diverifikasi kembali pada data terbaru yang tidak digunakan saat pemilihan metode.">
        <EchoStatGrid items={validationStats} />
      </Section>

      <Section id="echo-pattern" title="Evaluasi Beberapa Periode" subtitle={`Periode terbaik L${item.audit.strongestWindow} · periode terlemah L${item.audit.weakestWindow}`}>
        <EchoWindowList windows={item.audit.windows} />
      </Section>

      <Section id="echo-consensus" title="Dukungan Metode" subtitle="Satu wakil dipilih dari setiap keluarga sebelum model dibandingkan. Ensemble dibekukan sebelum verifikasi akhir.">
        <div className={styles.consensusCard}>
          <strong>{item.familyAgreement}%</strong>
          <div>
            <b>Kategori {item.strength}</b>
            <p>{item.consensusFamilies.map((family) => FAMILY_LABEL[family]).join(", ") || FAMILY_LABEL[item.family]}</p>
          </div>
        </div>
        {item.contributors.map((contributor) => (
          <div className={styles.consensusCard} key={`${contributor.group}-${contributor.formula}`}>
            <strong>{contributor.weight}%</strong>
            <div>
              <b>{FAMILY_LABEL[contributor.family]}</b>
              <p>{contributor.formula} · angka {contributor.digits.join("")} · lift uji {contributor.validationLift >= 0 ? "+" : ""}{contributor.validationLift}%</p>
            </div>
          </div>
        ))}
      </Section>

      <Section id="echo-analogs" title="Pola Historis Paling Mirip" subtitle="Data yang terlalu berdekatan dibatasi agar satu periode tidak mendominasi hasil.">
        <EchoNeighborList neighbors={item.result.neighbors} />
      </Section>

      <Section id="echo-audit" title="Riwayat Pengujian" subtitle="A = evaluasi awal, U = uji berurutan, V = verifikasi akhir.">
        <EchoWalkForwardList rows={item.result.rows} />
      </Section>
    </div>
  );
}
