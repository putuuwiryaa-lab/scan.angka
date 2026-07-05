import { NextResponse } from "next/server";
import { runAutoScan } from "@/lib/engine/acke-engine";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import { isScanMode, isShioMode, isTarget2D, isTarget3D } from "@/lib/engine/helpers";
import type { Draw, Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { requireActiveAccess } from "@/lib/server/access";
import { MAX_BATCH_MARKETS } from "@/lib/shared/batch";
import { getSupabase } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DIGIT_COUNT = 7;
const TOPS = [1, 2, 3];

type MarketRow = { id: string; name: string | null; history_data: string | null };
type BatchLine = { id: string; name: string; digits: string };
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
};

type ScanRequest = {
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  topRanks: number[];
  L: number;
};

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

function readScanRequest(source: Record<string, unknown>, fallback?: Partial<ScanRequest>): ScanRequest | string {
  if (source.scanMode !== undefined && !isScanMode(source.scanMode)) return "Jenis scan tidak valid.";
  if (source.targetPos !== undefined && !isPosisi(source.targetPos)) return "Target posisi tidak valid.";
  if (source.target2D !== undefined && !isTarget2D(source.target2D)) return "Target 2D tidak valid.";
  if (source.target3D !== undefined && !isTarget3D(source.target3D)) return "Target 3D tidak valid.";

  const fallbackTop = fallback?.topRanks?.[0] ?? 1;
  const legacyTop = asNum(source.stopScan, fallbackTop, 1, 3);

  return {
    scanMode: (source.scanMode ?? fallback?.scanMode ?? "posisi") as ScanMode,
    targetPos: (source.targetPos ?? fallback?.targetPos ?? "K") as Posisi,
    target2D: (source.target2D ?? fallback?.target2D ?? "belakang") as Target2D,
    target3D: (source.target3D ?? fallback?.target3D ?? "belakang") as Target3D,
    digitCount: asNum(source.digitCount, fallback?.digitCount ?? DEFAULT_DIGIT_COUNT, 1, 12),
    topRanks: normalizeTopRanks(source.topRanks, legacyTop),
    L: asNum(source.L, fallback?.L ?? 14, 1, 100),
  };
}

function selectedBatchDigits(draws: Draw[], request: ScanRequest): string {
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

export async function POST(req: Request) {
  const access = await requireActiveAccess(req.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const marketIds = normalizeMarketIds(body.marketIds);

    if (marketIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal 1 pasaran." }, { status: 400 });
    }

    if (marketIds.length > MAX_BATCH_MARKETS) {
      return NextResponse.json({ error: `Maksimal ${MAX_BATCH_MARKETS} pasaran per batch scan.` }, { status: 413 });
    }

    const primarySource = asRecord(body) ?? {};
    const primary = readScanRequest(primarySource);
    if (typeof primary === "string") return NextResponse.json({ error: primary }, { status: 400 });

    const secondarySource = asRecord(body.secondary);
    const secondary = secondarySource ? readScanRequest(secondarySource, primary) : null;
    if (typeof secondary === "string") return NextResponse.json({ error: secondary.replace("Jenis", "Metode kedua") }, { status: 400 });

    const title = typeof body.outputTitle === "string" && body.outputTitle.trim() ? body.outputTitle.trim() : `Output ${primary.digitCount}D`;

    const { data, error } = await getSupabase()
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
        results.push({ id, name, digits: "-" });
        continue;
      }

      try {
        const draws = parseStrictHistory(market.history_data);
        const primaryDigits = selectedBatchDigits(draws, primary);
        const secondaryDigits = secondary ? selectedBatchDigits(draws, secondary) : "";
        results.push({ id, name, digits: secondary ? `${primaryDigits} · ${secondaryDigits}` : primaryDigits });
      } catch (error) {
        if (error instanceof HistoryDataFormatError) {
          return NextResponse.json({ error: `Data ${name} salah. ${error.message}` }, { status: 422 });
        }
        throw error;
      }
    }

    const lines = results.map((row: BatchLine) => `${row.name} ➜ ${row.digits}`);
    const copyText = [title, "", ...lines].join("\n");
    return NextResponse.json({ title, results, lines, copyText, limit: MAX_BATCH_MARKETS, topRanks: primary.topRanks, secondary: Boolean(secondary) });
  } catch (error) {
    console.error("[api/batch-scan] Request error", error);
    return NextResponse.json({ error: "Batch scan gagal." }, { status: 400 });
  }
}