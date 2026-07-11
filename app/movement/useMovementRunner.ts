"use client";

import { useState } from "react";
import type {
  MovementOutputType,
  MovementResult,
  MovementTarget,
} from "../../lib/movement/types";

type RunMovementParams = {
  marketId: string;
  outputType: MovementOutputType;
  target: MovementTarget;
  digitCount: number;
  onBeforeRun?: () => void;
};

function userFacingError(message: unknown): string {
  const text = String(message || "").toLowerCase();
  if (text.includes("data belum cukup") || text.includes("minimal 28")) {
    return "Riwayat keluaran belum mencukupi. Diperlukan minimal 28 result untuk training awal dan walk-forward L14.";
  }
  if (text.includes("pasaran") && text.includes("pilih")) {
    return "Pilih pasaran terlebih dahulu untuk memulai analisa.";
  }
  if (text.includes("belum punya data") || text.includes("history")) {
    return "Pasaran ini belum memiliki riwayat keluaran yang dapat dianalisa.";
  }
  if (text.includes("target")) return "Target analisa tidak sesuai dengan jenis output yang dipilih.";
  if (text.includes("mengambil data")) {
    return "Data pasaran belum dapat dimuat. Silakan coba kembali.";
  }
  return "Analisa belum dapat diproses. Silakan coba kembali.";
}

export function useMovementRunner() {
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<MovementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [movementError, setMovementError] = useState("");

  async function runMovement(params: RunMovementParams) {
    setLoading(true);
    setMovementError("");
    setResult(null);
    params.onBeforeRun?.();

    try {
      const response = await fetch("/api/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: params.marketId,
          outputType: params.outputType,
          target: params.target,
          digitCount: params.digitCount,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setMovementError(userFacingError(data.error));
        return;
      }
      setMarketName(data.market ?? "");
      setResult(data.result);
    } catch {
      setMovementError("Terjadi kendala saat memproses analisa. Periksa koneksi, lalu coba kembali.");
    } finally {
      setLoading(false);
    }
  }

  return { marketName, result, loading, movementError, runMovement };
}
