"use client";

import { useState } from "react";
import { MAX_ADAPTIVE_BATCH_MARKETS, MAX_BATCH_MARKETS } from "../constants";
import { outputTitle } from "../helpers";
import { copyTextToClipboard } from "../../shared/copy";
import { clampTextNumber } from "../../shared/scan-utils";
import {
  clampBatchDigitCount,
  isAdaptiveBatchMode,
  type BatchAnalysisMode,
} from "../../../lib/shared/batch-analysis";
import type { BatchResult } from "../types";
import type { Posisi, Target2D, Target3D } from "../../shared/types";

type RunBatchParams = {
  selected: string[];
  rounds: string;
  scanMode: BatchAnalysisMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  topRanks: number[];
  lineSeparator: string;
  secondaryScanMode: BatchAnalysisMode | "";
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
const DEFAULT_LINE_SEPARATOR = "➜";

function safeRanks(value: number[]): number[] {
  const clean = TOPS.filter((item) => value.includes(item));
  return clean.length ? clean : [1];
}

function titleRanks(value: number[]): string {
  return safeRanks(value).map((item) => `Top ${item}`).join("+");
}

function safeLineSeparator(value: string): string {
  const separator = value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 16);
  return separator || DEFAULT_LINE_SEPARATOR;
}

function buildMethodTitle(
  mode: BatchAnalysisMode,
  targetPos: Posisi,
  target2D: Target2D,
  target3D: Target3D,
  digitCount: number,
  rounds: number,
  ranks: number[],
): string {
  const base = outputTitle(mode, targetPos, target2D, target3D, digitCount);
  return isAdaptiveBatchMode(mode)
    ? `${base} · Validasi L14`
    : `${base} ${titleRanks(ranks)} L${rounds}`;
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
      const adaptive = isAdaptiveBatchMode(params.scanMode) ||
        (Boolean(params.secondaryScanMode) && isAdaptiveBatchMode(params.secondaryScanMode));
      const maximumMarkets = adaptive ? MAX_ADAPTIVE_BATCH_MARKETS : MAX_BATCH_MARKETS;
      if (params.selected.length > maximumMarkets) {
        setRunnerError(`Maksimal ${maximumMarkets} pasaran untuk konfigurasi batch ini.`);
        return;
      }

      const safeRounds = clampTextNumber(params.rounds, 14, 1, 100);
      const safeDigit = clampBatchDigitCount(params.scanMode, params.digitCount);
      const ranks = isAdaptiveBatchMode(params.scanMode) ? [1] : safeRanks(params.topRanks);
      const lineSeparator = safeLineSeparator(params.lineSeparator);
      const primaryTitle = buildMethodTitle(
        params.scanMode,
        params.targetPos,
        params.target2D,
        params.target3D,
        safeDigit,
        safeRounds,
        ranks,
      );

      let secondaryPayload: Record<string, unknown> | undefined;
      let secondaryTitle = "";
      if (params.secondaryScanMode) {
        const rounds2 = clampTextNumber(params.secondaryRounds, 14, 1, 100);
        const digit2 = clampBatchDigitCount(params.secondaryScanMode, params.secondaryDigitCount);
        const ranks2 = isAdaptiveBatchMode(params.secondaryScanMode) ? [1] : safeRanks(params.secondaryTopRanks);
        secondaryTitle = buildMethodTitle(
          params.secondaryScanMode,
          params.secondaryTargetPos,
          params.secondaryTarget2D,
          params.secondaryTarget3D,
          digit2,
          rounds2,
          ranks2,
        );
        secondaryPayload = {
          scanMode: params.secondaryScanMode,
          targetPos: params.secondaryTargetPos,
          target2D: params.secondaryTarget2D,
          target3D: params.secondaryTarget3D,
          digitCount: digit2,
          topRanks: ranks2,
          L: rounds2,
        };
        if (!isAdaptiveBatchMode(params.secondaryScanMode)) {
          params.onSecondaryRoundsChange(String(rounds2));
          params.onSecondaryTopRanksChange(ranks2);
        }
        params.onSecondaryDigitCountChange(digit2);
      }

      if (!isAdaptiveBatchMode(params.scanMode)) {
        params.onRoundsChange(String(safeRounds));
        params.onTopRanksChange(ranks);
      }
      params.onDigitCountChange(safeDigit);

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
          lineSeparator,
          secondary: secondaryPayload,
          outputTitle: secondaryPayload ? `${primaryTitle} · ${secondaryTitle}` : primaryTitle,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) setRunnerError(data.error || "Batch analisis gagal.");
      else setResult(data);
    } catch {
      setRunnerError("Batch analisis gagal. Periksa koneksi, lalu coba kembali.");
    } finally {
      setLoading(false);
    }
  }

  async function copyOutput() {
    if (!result) return;
    const success = await copyTextToClipboard(result.copyText);
    if (!success) {
      setRunnerError("Gagal copy output.");
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return { result, copied, loading, runnerError, runBatch, copyOutput };
}
