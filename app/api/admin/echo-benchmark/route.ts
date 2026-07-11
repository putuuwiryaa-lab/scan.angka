import { NextResponse } from "next/server";
import { isScanMode, isTarget2D, isTarget3D } from "@/lib/engine/helpers";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import type { Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { ECHO_INTERNAL_CONFIG, runEcho } from "@/lib/echo/engine";
import type { EchoDiagnostic, EchoFamilySummary, EchoResult } from "@/lib/echo/types";
import { requireAdminSession } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MarketRow = {
  id: string;
  name: string;
  history_data: string | null;
};

type BenchmarkStatus =
  | "released"
  | "candidate_rejected"
  | "holdout_rejected"
  | "insufficient_data"
  | "invalid_data"
  | "error";

type BenchmarkMarketResult = {
  marketId: string;
  marketName: string;
  dataSize: number;
  status: BenchmarkStatus;
  message: string;
  selectionKind: "single" | "ensemble" | null;
  family: string | null;
  formula: string | null;
  strength: string | null;
  score: number | null;
  discoveryLift: number | null;
  validationLift: number | null;
  holdoutLift: number | null;
  combinedLift: number | null;
  softAccepted: boolean;
  diagnostics: EchoDiagnostic[];
  familySummaries: EchoFamilySummary[];
};

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function clamp(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (!valid.length) return null;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
}

function selectedSummary(result: EchoResult): EchoFamilySummary | null {
  return result.familySummaries.find((summary) => summary.selected) ?? null;
}

function statusFor(result: EchoResult): BenchmarkStatus {
  if (result.items.length) return "released";
  return result.message.includes("verifikasi akhir") ? "holdout_rejected" : "candidate_rejected";
}

function benchmarkResult(
  market: MarketRow,
  dataSize: number,
  result: EchoResult,
): BenchmarkMarketResult {
  const item = result.items[0] ?? null;
  const selected = selectedSummary(result);
  return {
    marketId: market.id,
    marketName: market.name,
    dataSize,
    status: statusFor(result),
    message: result.message,
    selectionKind: item?.selectionKind ?? null,
    family: item?.family ?? selected?.family ?? null,
    formula: item?.formula ?? selected?.formula ?? null,
    strength: item?.strength ?? null,
    score: item?.score ?? selected?.score ?? null,
    discoveryLift: item?.audit.discoveryLift ?? selected?.discoveryLift ?? null,
    validationLift: item?.audit.validationLift ?? selected?.validationLift ?? null,
    holdoutLift: item?.audit.holdoutLift ?? null,
    combinedLift: item?.release.combinedLift ?? null,
    softAccepted: item?.release.softAccepted ?? false,
    diagnostics: result.diagnostics,
    familySummaries: result.familySummaries,
  };
}

function failedMarket(
  market: MarketRow,
  status: BenchmarkStatus,
  message: string,
  dataSize = 0,
): BenchmarkMarketResult {
  return {
    marketId: market.id,
    marketName: market.name,
    dataSize,
    status,
    message,
    selectionKind: null,
    family: null,
    formula: null,
    strength: null,
    score: null,
    discoveryLift: null,
    validationLift: null,
    holdoutLift: null,
    combinedLift: null,
    softAccepted: false,
    diagnostics: [],
    familySummaries: [],
  };
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function aggregate(results: BenchmarkMarketResult[]) {
  const evaluated = results.filter((result) =>
    result.status === "released" ||
    result.status === "candidate_rejected" ||
    result.status === "holdout_rejected");
  const released = results.filter((result) => result.status === "released");
  const statusCounts = countBy(results.map((result) => result.status));
  const rejectionCounts = countBy(results.flatMap((result) => result.diagnostics.map((diagnostic) => diagnostic.code)));
  const selectionCounts = countBy(released.map((result) => result.selectionKind ?? "unknown"));
  const familyCounts = countBy(released.map((result) => result.family ?? "unknown"));
  const familyEligibilityCounts = countBy(results.flatMap((result) =>
    result.familySummaries
      .filter((summary) => summary.eligible)
      .map((summary) => summary.group)));

  return {
    batchSize: results.length,
    evaluated: evaluated.length,
    released: released.length,
    releaseRate: evaluated.length ? Number(((released.length / evaluated.length) * 100).toFixed(1)) : 0,
    statusCounts,
    rejectionCounts,
    selectionCounts,
    familyCounts,
    familyEligibilityCounts,
    softAccepted: released.filter((result) => result.softAccepted).length,
    averageScore: average(released.map((result) => result.score)),
    averageDiscoveryLift: average(evaluated.map((result) => result.discoveryLift)),
    averageValidationLift: average(evaluated.map((result) => result.validationLift)),
    averageHoldoutLift: average(released.map((result) => result.holdoutLift)),
    averageCombinedLift: average(released.map((result) => result.combinedLift)),
  };
}

export async function POST(request: Request) {
  const admin = requireAdminSession(request.headers);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.scanMode !== undefined && !isScanMode(body.scanMode)) {
      return NextResponse.json({ error: "Jenis prediksi tidak valid." }, { status: 400 });
    }
    if (body?.targetPos !== undefined && !isPosisi(body.targetPos)) {
      return NextResponse.json({ error: "Target posisi tidak valid." }, { status: 400 });
    }
    if (body?.target2D !== undefined && !isTarget2D(body.target2D)) {
      return NextResponse.json({ error: "Target 2D tidak valid." }, { status: 400 });
    }
    if (body?.target3D !== undefined && !isTarget3D(body.target3D)) {
      return NextResponse.json({ error: "Target 3D tidak valid." }, { status: 400 });
    }

    const scanMode = (body?.scanMode ?? "ai_2d_belakang") as ScanMode;
    const targetPos = (body?.targetPos ?? "K") as Posisi;
    const target2D = (body?.target2D ?? "belakang") as Target2D;
    const target3D = (body?.target3D ?? "belakang") as Target3D;
    const digitCount = clamp(body?.digitCount, 4, 1, scanMode === "shio" || scanMode === "off_shio" ? 12 : 9);
    const limit = clamp(body?.limit, 10, 1, 25);
    const offset = clamp(body?.offset, 0, 0, 100_000);
    const marketIds = Array.isArray(body?.marketIds)
      ? body.marketIds.map((value: unknown) => String(value || "").trim()).filter(Boolean).slice(0, 25)
      : [];

    const supabase = createAdminClient();
    let query = supabase
      .from("markets")
      .select("id, name, history_data", { count: "exact" })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);
    if (marketIds.length) query = query.in("id", marketIds);

    const { data, error, count } = await query;
    if (error) {
      console.error("[api/admin/echo-benchmark] Supabase error", error);
      return NextResponse.json({ error: "Gagal mengambil daftar pasaran." }, { status: 500 });
    }

    const markets = (data ?? []) as MarketRow[];
    const results: BenchmarkMarketResult[] = [];

    for (const market of markets) {
      if (!market.history_data?.trim()) {
        results.push(failedMarket(market, "insufficient_data", "Pasaran belum memiliki riwayat keluaran."));
        continue;
      }

      try {
        const draws = parseStrictHistory(market.history_data);
        if (draws.length < ECHO_INTERNAL_CONFIG.minimumTotalData) {
          results.push(failedMarket(
            market,
            "insufficient_data",
            `Data ${draws.length}; minimum ${ECHO_INTERNAL_CONFIG.minimumTotalData}.`,
            draws.length,
          ));
          continue;
        }

        const result = runEcho(draws, {
          scanMode,
          targetPos,
          target2D,
          target3D,
          digitCount,
        });
        results.push(benchmarkResult(market, draws.length, result));
      } catch (benchmarkError) {
        if (benchmarkError instanceof HistoryDataFormatError) {
          results.push(failedMarket(market, "invalid_data", benchmarkError.message));
          continue;
        }
        const message = benchmarkError instanceof Error ? benchmarkError.message : "Benchmark gagal.";
        results.push(failedMarket(market, "error", message));
      }
    }

    const total = count ?? markets.length;
    const nextOffset = offset + markets.length < total ? offset + markets.length : null;
    return NextResponse.json({
      config: {
        scanMode,
        targetPos,
        target2D,
        target3D,
        digitCount,
        limit,
        offset,
      },
      pagination: {
        total,
        returned: markets.length,
        nextOffset,
      },
      aggregate: aggregate(results),
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Benchmark Echo gagal.";
    console.error("[api/admin/echo-benchmark] Request error", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
