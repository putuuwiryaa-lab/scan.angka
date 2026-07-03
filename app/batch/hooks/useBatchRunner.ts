"use client";

import { useState } from "react";
import { MAX_BATCH_MARKETS } from "../constants";
import { outputTitle } from "../helpers";
import { clampTextNumber, isShioMode } from "../../shared/scan-utils";
import type { BatchResult } from "../types";
import type { Posisi, ScanMode, Target2D, Target3D } from "../../shared/types";

type RunBatchParams = {
  selected: string[];
  rounds: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  onRoundsChange: (value: string) => void;
  onDigitCountChange: (value: number) => void;
};

export function useBatchRunner() {
  const [result, setResult] = useState<BatchResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runnerError, setRunnerError] = useState("");

  async function runBatch({
    selected,
    rounds,
    scanMode,
    targetPos,
    target2D,
    target3D,
    digitCount,
    onRoundsChange,
    onDigitCountChange,
  }: RunBatchParams) {
    setLoading(true);
    setRunnerError("");
    setResult(null);
    setCopied(false);

    try {
      if (selected.length > MAX_BATCH_MARKETS) {
        setRunnerError(`Maksimal ${MAX_BATCH_MARKETS} pasaran per batch scan.`);
        return;
      }

      const safeRounds = clampTextNumber(rounds, 14, 1, 100);
      const safeDigit = Math.max(1, Math.min(isShioMode(scanMode) ? 12 : 9, digitCount));
      const title = outputTitle(scanMode, targetPos, target2D, target3D, safeDigit);

      onRoundsChange(String(safeRounds));
      onDigitCountChange(safeDigit);

      const response = await fetch("/api/batch-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketIds: selected,
          L: safeRounds,
          scanMode,
          targetPos,
          target2D,
          target3D,
          digitCount: safeDigit,
          outputTitle: title,
        }),
      });
      const data = await response.json();
      if (data.error) setRunnerError(data.error); else setResult(data);
    } catch {
      setRunnerError("Batch scan gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function copyOutput() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setRunnerError("Gagal copy output.");
    }
  }

  return {
    result,
    copied,
    loading,
    runnerError,
    runBatch,
    copyOutput,
  };
}
