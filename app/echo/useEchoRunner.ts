"use client";

import { useState } from "react";
import { clampTextNumber, isShioMode } from "../shared/scan-utils";
import type { Posisi, ScanMode, Target2D, Target3D } from "../scan/types";
import type { EchoResult } from "../../lib/echo/types";

type RunEchoParams = {
  marketId: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  stopScan: string;
  onDigitCountChange: (value: number) => void;
  onStopScanChange: (value: string) => void;
  onBeforeRun?: () => void;
};

export function useEchoRunner() {
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<EchoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [echoError, setEchoError] = useState("");

  async function runEcho(params: RunEchoParams) {
    setLoading(true);
    setEchoError("");
    setResult(null);
    params.onBeforeRun?.();

    try {
      const maxDigit = isShioMode(params.scanMode) ? 12 : 9;
      const safeDigit = Math.max(1, Math.min(maxDigit, Number(params.digitCount) || 4));
      const safeStop = clampTextNumber(params.stopScan, 3, 1, 20);
      params.onDigitCountChange(safeDigit);
      params.onStopScanChange(String(safeStop));

      const response = await fetch("/api/echo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: params.marketId,
          targetPos: params.targetPos,
          target2D: params.target2D,
          target3D: params.target3D,
          digitCount: safeDigit,
          stopScan: safeStop,
          scanMode: params.scanMode,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setEchoError(data.error || "Echo gagal.");
        return;
      }
      setMarketName(data.market ?? "");
      setResult(data.result);
    } catch {
      setEchoError("Echo gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return { marketName, result, loading, echoError, setEchoError, runEcho };
}
