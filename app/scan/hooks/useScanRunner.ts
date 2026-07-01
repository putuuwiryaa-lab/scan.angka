"use client";

import { useState } from "react";
import { clampTextNumber, isShioMode } from "../helpers";
import type { Posisi, ScanMode, ScanResult, Target2D } from "../types";

type RunScanParams = {
  marketId: string;
  rounds: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  digitCount: number;
  stopScan: string;
  onRoundsChange: (value: string) => void;
  onDigitCountChange: (value: number) => void;
  onStopScanChange: (value: string) => void;
  onBeforeRun?: () => void;
};

export function useScanRunner() {
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState("");

  async function runScan({
    marketId,
    rounds,
    scanMode,
    targetPos,
    target2D,
    digitCount,
    stopScan,
    onRoundsChange,
    onDigitCountChange,
    onStopScanChange,
    onBeforeRun,
  }: RunScanParams) {
    setLoading(true);
    setScanError("");
    setResult(null);
    onBeforeRun?.();

    try {
      const safeRounds = clampTextNumber(rounds, 14, 1, 100);
      const maxDigit = isShioMode(scanMode) ? 12 : 9;
      const safeDigit = Math.max(1, Math.min(maxDigit, Number(digitCount) || 4));
      const safeStop = clampTextNumber(stopScan, 1, 1, 200);

      onRoundsChange(String(safeRounds));
      onDigitCountChange(safeDigit);
      onStopScanChange(String(safeStop));

      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          L: safeRounds,
          targetPos,
          target2D,
          digitCount: safeDigit,
          stopScan: safeStop,
          scanMode,
        }),
      });
      const data = await response.json();
      if (data.error) {
        setScanError(data.error);
        return;
      }
      setMarketName(data.market ?? "");
      setResult(data.result);
    } catch {
      setScanError("Scan gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return {
    marketName,
    result,
    loading,
    scanError,
    setScanError,
    runScan,
  };
}
