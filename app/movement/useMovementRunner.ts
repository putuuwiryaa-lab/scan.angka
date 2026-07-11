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
    return "Basis data belum memadai untuk validasi. Minimal 28 result diperlukan agar model dapat dievaluasi secara layak.";
  }
  if (text.includes("pasaran") && text.includes("pilih")) {
    return "Pilih pasaran analisis sebelum menjalankan proses prediksi.";
  }
  if (text.includes("belum punya data") || text.includes("history")) {
    return "Riwayat result pasaran ini belum tersedia untuk dianalisis.";
  }
  if (text.includes("target")) {
    return "Target analisis tidak sesuai dengan mode prediksi yang dipilih.";
  }
  if (text.includes("mengambil data")) {
    return "Data pasaran belum berhasil dimuat. Coba jalankan analisis kembali.";
  }
  return "Analisis belum dapat diselesaikan. Periksa konfigurasi, lalu coba kembali.";
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
      setMovementError("Koneksi terputus saat model sedang dievaluasi. Periksa jaringan, lalu jalankan kembali.");
    } finally {
      setLoading(false);
    }
  }

  return { marketName, result, loading, movementError, runMovement };
}
