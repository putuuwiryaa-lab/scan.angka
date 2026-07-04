import { NextResponse } from "next/server";
import { runAutoScan } from "@/lib/engine/acke-engine";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import { isScanMode, isShioMode, isTarget2D, isTarget3D } from "@/lib/engine/helpers";
import type { Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { MAX_BATCH_MARKETS } from "@/lib/shared/batch";
import { getSupabase } from "@/lib/supabase/client";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DIGIT_COUNT = 7;

type MarketRow = { id: string; name: string | null; history_data: string | null };
type BatchLine = { id: string; name: string; digits: string };
type Body = { marketIds?: unknown; scanMode?: unknown; targetPos?: unknown; target2D?: unknown; target3D?: unknown; digitCount?: unknown; L?: unknown; outputTitle?: unknown };

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
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

export async function POST(req: Request) {
  const access = await verifyActiveTelegramSession(req.headers);
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

    if (body.scanMode !== undefined && !isScanMode(body.scanMode)) {
      return NextResponse.json({ error: "Jenis scan tidak valid." }, { status: 400 });
    }

    if (body.targetPos !== undefined && !isPosisi(body.targetPos)) {
      return NextResponse.json({ error: "Target posisi tidak valid." }, { status: 400 });
    }

    if (body.target2D !== undefined && !isTarget2D(body.target2D)) {
      return NextResponse.json({ error: "Target 2D tidak valid." }, { status: 400 });
    }

    if (body.target3D !== undefined && !isTarget3D(body.target3D)) {
      return NextResponse.json({ error: "Target 3D tidak valid." }, { status: 400 });
    }

    const scanMode = (body.scanMode ?? "posisi") as ScanMode;
    const targetPos = (body.targetPos ?? "K") as Posisi;
    const target2D = (body.target2D ?? "belakang") as Target2D;
    const target3D = (body.target3D ?? "belakang") as Target3D;
    const digitCount = asNum(body.digitCount, DEFAULT_DIGIT_COUNT, 1, 12);
    const L = asNum(body.L, 14, 1, 100);
    const title = typeof body.outputTitle === "string" && body.outputTitle.trim() ? body.outputTitle.trim() : `Output ${digitCount}D`;

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
        const result = runAutoScan(draws, { L, targetPos, target2D, target3D, digitCount, stopScan: 1, scanMode });
        results.push({ id, name, digits: formatCandidates(result.items[0]?.angkaHidup ?? [], scanMode, digitCount) });
      } catch (error) {
        if (error instanceof HistoryDataFormatError) {
          return NextResponse.json({ error: `Data ${name} salah. ${error.message}` }, { status: 422 });
        }
        throw error;
      }
    }

    const lines = results.map((row: BatchLine) => `${row.name} ➜ ${row.digits}`);
    const copyText = [title, "", ...lines].join("\n");
    return NextResponse.json({ title, results, lines, copyText, limit: MAX_BATCH_MARKETS });
  } catch (error) {
    console.error("[api/batch-scan] Request error", error);
    return NextResponse.json({ error: "Batch scan gagal." }, { status: 400 });
  }
}
