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
  topRanks: number[];
  secondaryScanMode: ScanMode | "";
  secondaryRounds: string;
  secondaryTargetPos: Posisi;
  secondaryTarget2D: Target2D;
  secondaryTarget3D: Target3D;
  secondaryDigitCount: number;
  secondaryTopRanks: number[];
  onRoundsChange: (value: string) => void;
  onDigitCountChange: (value: number) => void;
  onTopRanksChange: (value: number[]) => void;
  onSecondaryRoundsChange: (value: string) => void;
  onSecondaryDigitCountChange: (value: number) => void;
  onSecondaryTopRanksChange: (value: number[]) => void;
};

const TOPS = [1, 2, 3];

function clampDigit(mode: ScanMode, value: number): number {
  return Math.max(1, Math.min(isShioMode(mode) ? 12 : 9, value));
}

function safeRanks(value: number[]): number[] {
  const clean = TOPS.filter((item) => value.includes(item));
  return clean.length ? clean : [1];
}

function titleRanks(value: number[]): string {
  return safeRanks(value).map((item) => `Top ${item}`).join("+");
}

export function useBatchRunner() {
  const [result, setResult] = useState<BatchResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runnerError, setRunnerError] = useState("");

  async function runBatch(params: RunBatchParams) {
    setLoading(true);
    setRunnerError("");
    setResult(null);
    setCopied(false);

    try {
      if (params.selected.length > MAX_BATCH_MARKETS) {
        setRunnerError(`Maksimal ${MAX_BATCH_MARKETS} pasaran per batch scan.`);
        return;
      }

      const safeRounds = clampTextNumber(params.rounds, 14, 1, 100);
      const safeDigit = clampDigit(params.scanMode, params.digitCount);
      const ranks = safeRanks(params.topRanks);
      const primaryTitle = `${outputTitle(params.scanMode, params.targetPos, params.target2D, params.target3D, safeDigit)} ${titleRanks(ranks)} L${safeRounds}`;

      let secondaryPayload: Record<string, unknown> | undefined;
      let secondaryTitle = "";
      if (params.secondaryScanMode) {
        const rounds2 = clampTextNumber(params.secondaryRounds, 14, 1, 100);
        const digit2 = clampDigit(params.secondaryScanMode, params.secondaryDigitCount);
        const ranks2 = safeRanks(params.secondaryTopRanks);
        secondaryTitle = `${outputTitle(params.secondaryScanMode, params.secondaryTargetPos, params.secondaryTarget2D, params.secondaryTarget3D, digit2)} ${titleRanks(ranks2)} L${rounds2}`;
        secondaryPayload = {
          scanMode: params.secondaryScanMode,
          targetPos: params.secondaryTargetPos,
          target2D: params.secondaryTarget2D,
          target3D: params.secondaryTarget3D,
          digitCount: digit2,
          topRanks: ranks2,
          L: rounds2,
        };
        params.onSecondaryRoundsChange(String(rounds2));
        params.onSecondaryDigitCountChange(digit2);
        params.onSecondaryTopRanksChange(ranks2);
      }

      params.onRoundsChange(String(safeRounds));
      params.onDigitCountChange(safeDigit);
      params.onTopRanksChange(ranks);

      const response = await fetch("/api/batch-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketIds: params.selected,
          L: safeRounds,
          scanMode: params.scanMode,
          targetPos: params.targetPos,
          target2D: params.target2D,
          target3D: params.target3D,
          digitCount: safeDigit,
          topRanks: ranks,
          secondary: secondaryPayload,
          outputTitle: secondaryPayload ? `${primaryTitle} · ${secondaryTitle}` : primaryTitle,
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

  return { result, copied, loading, runnerError, runBatch, copyOutput };
}