import { NextResponse } from "next/server";
import { runAutoScanFromHistory } from "@/lib/engine/acke-engine";
import type { Posisi, ScanMode } from "@/lib/engine/types";
import { getSupabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

const MAX_BATCH_MARKETS = 30;

type MarketRow = { id: string; name: string | null; history_data: string | null };
type BatchLine = { id: string; name: string; digits: string };
type Body = { marketIds?: unknown; scanMode?: unknown; targetPos?: unknown; digitCount?: unknown; L?: unknown; outputTitle?: unknown };

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

function asPos(value: unknown): Posisi {
  return value === "A" || value === "C" || value === "E" ? value : "K";
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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const marketIds = normalizeMarketIds(body.marketIds);

    if (marketIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal 1 pasaran." }, { status: 400 });
    }

    if (marketIds.length > MAX_BATCH_MARKETS) {
      return NextResponse.json({ error: `Maksimal ${MAX_BATCH_MARKETS} pasaran per batch scan.` }, { status: 413 });
    }

    const scanMode = (typeof body.scanMode === "string" ? body.scanMode : "posisi") as ScanMode;
    const targetPos = asPos(body.targetPos);
    const digitCount = asNum(body.digitCount, 7, 1, 9);
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
    const results: BatchLine[] = marketIds.map((id: string) => {
      const market = byId.get(id);
      const name = titleCase(market?.name ?? id);
      if (!market?.history_data) return { id, name, digits: "-" };

      try {
        const result = runAutoScanFromHistory(market.history_data, { L, targetPos, digitCount, stopScan: 1, scanMode });
        return { id, name, digits: result.items[0]?.angkaHidup.join("") || "-" };
      } catch {
        return { id, name, digits: "-" };
      }
    });

    const lines = results.map((row: BatchLine) => `${row.name} ⟢ ${row.digits}`);
    const copyText = [title, "", ...lines].join("\n");
    return NextResponse.json({ title, results, lines, copyText, limit: MAX_BATCH_MARKETS });
  } catch (error) {
    console.error("[api/batch-scan] Request error", error);
    return NextResponse.json({ error: "Batch scan gagal." }, { status: 400 });
  }
}
