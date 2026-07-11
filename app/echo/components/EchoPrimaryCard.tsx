"use client";

import { useState } from "react";
import { analysisTitle, labelsFromValues } from "../../scan/helpers";
import type { EchoItem } from "../../../lib/echo/types";
import { buildEchoCopyText, confidenceLabel, profileTitle } from "../presentation";
import styles from "../echo-result.module.css";
import cardStyles from "./EchoPrimaryCard.module.css";

function digitLayoutClass(count: number): string {
  if (count >= 7) return cardStyles.mainDigitsDense;
  if (count >= 5) return cardStyles.mainDigitsMedium;
  return cardStyles.mainDigitsCompact;
}

export default function EchoPrimaryCard({ item, marketName }: { item: EchoItem; marketName: string }) {
  const digits = labelsFromValues(item.angkaHidup, item.scanMode);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = buildEchoCopyText(item, marketName);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1700);
  }

  return (
    <section id="echo-result" className={`${styles.panel} ${styles.primaryCard}`}>
      <div className={styles.primaryHead}>
        <div className={styles.primaryIdentity}>
          <span className={styles.eyebrow}>REKOMENDASI UTAMA · KATEGORI {item.strength}</span>
          <h2>{profileTitle(item)}</h2>
          <code>{item.formula}</code>
        </div>
        <div className={`${styles.confidenceBadge} ${styles[item.confidenceLevel.toLowerCase()]}`}>
          <span>{confidenceLabel(item.confidenceLevel)}</span>
          <strong>{item.confidence}</strong>
        </div>
      </div>

      <p className={styles.marketLine}>
        <b>{marketName}</b>
        <span>·</span>
        <span>{analysisTitle(item.scanMode, item.targetPos, item.target2D, item.target3D)}</span>
      </p>

      <div
        className={`${cardStyles.mainDigits} ${digitLayoutClass(digits.length)}`}
        aria-label={`${digits.length} angka rekomendasi`}
      >
        {digits.map((digit, index) => <span key={`${digit}-${index}`}>{digit}</span>)}
      </div>

      <div className={cardStyles.summaryGrid} aria-label="Ringkasan evaluasi">
        <span><b>{item.score}</b><small>Nilai</small></span>
        <span><b>{item.audit.walkForwardHit}/{item.audit.walkForwardTotal}</b><small>Uji berurutan</small></span>
        <span><b>{item.audit.holdoutHit}/{item.audit.holdoutTotal}</b><small>Verifikasi akhir</small></span>
        <span><b>{item.familyAgreement}%</b><small>Dukungan metode</small></span>
      </div>

      <button
        className={`${styles.copyButton} ${copied ? styles.copyButtonCopied : ""}`}
        type="button"
        onClick={handleCopy}
        aria-live="polite"
      >
        <span aria-hidden="true">{copied ? "✓" : "⧉"}</span>
        <span>{copied ? "Rekomendasi berhasil disalin" : "Salin Rekomendasi"}</span>
      </button>
    </section>
  );
}
