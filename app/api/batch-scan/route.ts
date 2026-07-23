import { NextResponse } from "next/server";
import { runAutoScan } from "@/lib/engine/acke-engine";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import { isShioMode, isTarget2D, isTarget3D } from "@/lib/engine/helpers";
import type { Draw, Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { runMovementEngine } from "@/lib/movement/engine";
import { MOVEMENT_METHOD_LABELS } from "@/lib/movement/types";
import {
  adaptiveOutputType,
  adaptiveTarget,
  clampBatchDigitCount,
  isAdaptiveBatchMode,
  isBatchAnalysisMode,
  type AdaptiveBatchMode,
  type BatchAnalysisMode,
} from "@/lib/shared/batch-analysis";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";
import {
  ADAPTIVE_BATCH_CHUNK_SIZE,
  MAX_ADAPTIVE_BATCH_MARKETS,
  MAX_BATCH_MARKETS,
} from "@/lib/shared/batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DIGIT_COUNT = 7;
const DEFAULT_LINE_SEPARATOR = "➜";
const TOPS = [1, 2, 3];

type MarketRow = { id: string; name: string | null; history_data: string | null };
type BatchLine = {
  id: string;
  name: string;
  digits: string;
  method?: string;
  window?: number;
  validation?: string;
};
type Body = {
  marketIds?: unknown;
  scanMode?: unknown;
  targetPos?: unknown;
  target2D?: unknown;
  target3D?: unknown;
  digitCount?: unknown;
  stopScan?: unknown;
  topRanks?: unknown;
  L?: unknown;
  secondary?: unknown;
  outputTitle?: unknown;
  lineSeparator?: unknown;
};

type CommonRequest = {
  scanMode: BatchAnalysisMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
};

type LegacyScanRequest = CommonRequest & {
  kind: "scan";
  scanMode: ScanMode;
  topRanks: number[];
  L: number;
};

type AdaptiveRequest = CommonRequest & {
  kind: "adaptive";
  scanMode: AdaptiveBatchMode;
  topRanks: [1];
  L: 14;
};

type AnalysisRequest = LegacyScanRequest | AdaptiveRequest;

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asNum(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeMarketIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item: unknown) => String(item).trim()).filter(Boolean))];
}

function normalizeTopRanks(value: unknown, fallbackRank: number): number[] {
  if (!Array.isArray(value)) return [fallbackRank];
  const ranks = TOPS.filter((rank) => value.map(Number).includes(rank));
  return ranks.length ? ranks : [fallbackRank];
}

function normalizeLineSeparator(value: unknown): string {
  const separator = String(value ?? DEFAULT_LINE_SEPARATOR)
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 16);
  return separator || DEFAULT_LINE_SEPARATOR;
}

function shioLabel(value: number): string {
  return String(value + 1).padStart(2, "0");
}

function groupByFour(value: string): string {
  return value.replace(/(.{4})(?=.)/g, "$1 ");
}

function formatCandidates(values: number[], scanMode: ScanMode, digitCount: number): string {
  if (!values.length) return "-";
  if (isShioMode(scanMode)) return values.map(shioLabel).join("-");

  const raw = values.join("");
  if (scanMode === "ai_3d" && digitCount === 8) return groupByFour(raw);
  return raw;
}

function formatBatchLine(row: BatchLine, separator: string): string {
  return `${row.name} ${separator} ${row.digits}`;
}

function readAnalysisRequest(source: Record<string, unknown>, fallback?: Partial<AnalysisRequest>): AnalysisRequest | string {
  if (source.scanMode !== undefined && !isBatchAnalysisMode(source.scanMode)) return "Jenis analisis tidak valid.";
  if (source.targetPos !== undefined && !isPosisi(source.targetPos)) return "Target posisi tidak valid.";
  if (source.target2D !== undefined && !isTarget2D(source.target2D)) return "Target 2D tidak valid.";
  if (source.target3D !== undefined && !isTarget3D(source.target3D)) return "Target 3D tidak valid.";

  const mode = (source.scanMode ?? fallback?.scanMode ?? "posisi") as BatchAnalysisMode;
  const targetPos = (source.targetPos ?? fallback?.targetPos ?? "K") as Posisi;
  const target2D = (source.target2D ?? fallback?.target2D ?? "belakang") as Target2D;
  const target3D = (source.target3D ?? fallback?.target3D ?? "belakang") as Target3D;
  const rawDigit = asNum(source.digitCount, fallback?.digitCount ?? DEFAULT_DIGIT_COUNT, 1, 12);
  const digitCount = clampBatchDigitCount(mode, rawDigit);

  if (isAdaptiveBatchMode(mode)) {
    return {
      kind: "adaptive",
      scanMode: mode,
      targetPos,
      target2D,
      target3D,
      digitCount,
      topRanks: [1],
      L: 14,
    };
  }

  const fallbackTop = fallback?.topRanks?.[0] ?? 1;
  const legacyTop = asNum(source.stopScan, fallbackTop, 1, 3);
  return {
    kind: "scan",
    scanMode: mode,
    targetPos,
    target2D,
    target3D,
    digitCount,
    topRanks: normalizeTopRanks(source.topRanks, legacyTop),
    L: asNum(source.L, fallback?.L ?? 14, 1, 100),
  };
}

function selectedScanDigits(draws: Draw[], request: LegacyScanRequest): string {
  const maxRank = Math.max(...request.topRanks);
  const result = runAutoScan(draws, {
    L: request.L,
    targetPos: request.targetPos,
    target2D: request.target2D,
    target3D: request.target3D,
    digitCount: request.digitCount,
    stopScan: maxRank,
    scanMode: request.scanMode,
  });

  const digits = request.topRanks.map((rank) => {
    const item = result.items[rank - 1];
    return formatCandidates(item?.angkaHidup ?? [], request.scanMode, request.digitCount);
  });
  return digits.length ? digits.join(" | ") : "-";
}

function selectedAdaptiveResult(draws: Draw[], request: AdaptiveRequest): Omit<BatchLine, "id" | "name"> {
  try {
    const result = runMovementEngine(draws, {
      outputType: adaptiveOutputType(request.scanMode),
      target: adaptiveTarget(
        request.scanMode,
        request.targetPos,
        request.target2D,
        request.target3D,
      ),
      digitCount: request.digitCount,
    });
    return {
      digits: result.digits.join(""),
      method: MOVEMENT_METHOD_LABELS[result.selectedMethod],
      window: result.selectedWindow,
      validation: `${result.evaluation.l14.hit}/14`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("minimal 28") || message.includes("data belum cukup")) {
      return { digits: "DATA BELUM CUKUP" };
    }
    throw error;
  }
}

function selectedAnalysisResult(draws: Draw[], request: AnalysisRequest): Omit<BatchLine, "id" | "name"> {
  if (request.kind === "adaptive") return selectedAdaptiveResult(draws, request);
  return { digits: selectedScanDigits(draws, request) };
}

export async function POST(req: Request) {
  const access = await requireActiveAccess(req.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const marketIds = normalizeMarketIds(body.marketIds);
    const lineSeparator = normalizeLineSeparator(body.lineSeparator);

    if (marketIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal 1 pasaran." }, { status: 400 });
    }

    const primarySource = asRecord(body) ?? {};
    const primary = readAnalysisRequest(primarySource);
    if (typeof primary === "string") return NextResponse.json({ error: primary }, { status: 400 });

    const secondarySource = asRecord(body.secondary);
    const secondary = secondarySource ? readAnalysisRequest(secondarySource, primary) : null;
    if (typeof secondary === "string") return NextResponse.json({ error: secondary.replace("Jenis", "Metode kedua") }, { status: 400 });

    const adaptive = primary.kind === "adaptive" || secondary?.kind === "adaptive";
    const requestMaximum = adaptive ? ADAPTIVE_BATCH_CHUNK_SIZE : MAX_BATCH_MARKETS;
    if (marketIds.length > requestMaximum) {
      const message = adaptive
        ? `Maksimal ${ADAPTIVE_BATCH_CHUNK_SIZE} pasaran per request Adaptif.`
        : `Maksimal ${MAX_BATCH_MARKETS} pasaran untuk konfigurasi batch ini.`;
      return NextResponse.json({ error: message }, { status: 413 });
    }

    const title = typeof body.outputTitle === "string" && body.outputTitle.trim()
      ? body.outputTitle.trim()
      : adaptive
        ? `Adaptif ${primary.digitCount}D · Validasi L14`
        : `Output ${primary.digitCount}D`;

    const { data, error } = await createAdminClient()
      .from("markets")
      .select("id, name, history_data")
      .in("id", marketIds);

    if (error) {
      console.error("[api/batch-scan] Supabase error", error);
      return NextResponse.json({ error: "Gagal mengambil data pasaran." }, { status: 500 });
    }

    const rows = (data ?? []) as MarketRow[];
    const byId = new Map<string, MarketRow>(rows.map((row: MarketRow) => [row.id, row]));
    const results: BatchLine[] = [];

    for (const id of marketIds) {
      const market = byId.get(id);
      const name = titleCase(market?.name ?? id);
      if (!market?.history_data) {
        results.push({ id, name, digits: "DATA BELUM TERSEDIA" });
        continue;
      }

      try {
        const draws = parseStrictHistory(market.history_data);
        const primaryResult = selectedAnalysisResult(draws, primary);
        const secondaryResult = secondary ? selectedAnalysisResult(draws, secondary) : null;
        results.push({
          id,
          name,
          digits: secondaryResult ? `${primaryResult.digits} · ${secondaryResult.digits}` : primaryResult.digits,
          method: primaryResult.method,
          window: primaryResult.window,
          validation: primaryResult.validation,
        });
      } catch (error) {
        if (error instanceof HistoryDataFormatError) {
          return NextResponse.json({ error: `Data ${name} salah. ${error.message}` }, { status: 422 });
        }
        throw error;
      }
    }

    const lines = results.map((row: BatchLine) => formatBatchLine(row, lineSeparator));
    const copyText = [title, "", ...lines].join("\n");
    return NextResponse.json({
      title,
      results,
      lines,
      copyText,
      lineSeparator,
      limit: adaptive ? MAX_ADAPTIVE_BATCH_MARKETS : MAX_BATCH_MARKETS,
      topRanks: primary.kind === "scan" ? primary.topRanks : undefined,
      secondary: Boolean(secondary),
      adaptive,
    });
  } catch (error) {
    console.error("[api/batch-scan] Request error", error);
    return NextResponse.json({ error: "Batch analisis gagal." }, { status: 400 });
  }
}
