import { NextResponse } from "next/server";
import { runFormulaByName } from "@/lib/engine/acke-engine";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import { isScanMode, isShioMode, isTarget2D } from "@/lib/engine/helpers";
import { KOLOM, SHIO_KOLOM, type Kolom, type Posisi, type ScanMode, type Target2D } from "@/lib/engine/types";
import { getSupabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type Body = {
  marketId?: unknown;
  formula?: unknown;
  scanMode?: unknown;
  targetPos?: unknown;
  target2D?: unknown;
  L?: unknown;
  kolomHidup?: unknown;
};

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeColumns(value: unknown): Kolom[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>([...KOLOM, ...SHIO_KOLOM]);
  return value.map((item) => String(item).trim()).filter((item): item is Kolom => allowed.has(item));
}

function digitsFromColumns(deret: number[], columns: Kolom[]): number[] {
  const source = deret.length === 12 ? SHIO_KOLOM : KOLOM;
  return columns.map((column) => deret[source.indexOf(column)]).filter((digit): digit is number => Number.isFinite(digit));
}

function shioLabel(value: number): string {
  return String(value + 1).padStart(2, "0");
}

function formatPrediction(values: number[], scanMode: ScanMode): string {
  if (isShioMode(scanMode)) return values.map(shioLabel).join("-");
  return values.join("");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const marketId = String(body.marketId || "").trim();
    const formula = String(body.formula || "").trim();

    if (!marketId) return NextResponse.json({ error: "Pilih pasaran dulu." }, { status: 400 });
    if (!formula) return NextResponse.json({ error: "Rumus trek tidak valid." }, { status: 400 });
    if (!isScanMode(body.scanMode)) return NextResponse.json({ error: "Jenis scan tidak valid." }, { status: 400 });
    if (!isPosisi(body.targetPos)) return NextResponse.json({ error: "Target posisi tidak valid." }, { status: 400 });
    if (!isTarget2D(body.target2D)) return NextResponse.json({ error: "Target 2D tidak valid." }, { status: 400 });

    const kolomHidup = normalizeColumns(body.kolomHidup);
    if (kolomHidup.length === 0) return NextResponse.json({ error: "Kolom trek tidak lengkap." }, { status: 400 });

    const L = clamp(body.L, 14, 1, 100);
    const scanMode = body.scanMode;
    const targetPos = body.targetPos;
    const target2D = body.target2D;

    const { data, error } = await getSupabase()
      .from("markets")
      .select("history_data, name")
      .eq("id", marketId)
      .single();

    if (error) {
      console.error("[api/saved-trek] Supabase error", error);
      return NextResponse.json({ error: "Gagal mengambil data pasaran." }, { status: 500 });
    }
    if (!data?.history_data) return NextResponse.json({ error: "Pasaran ini belum punya data keluaran." }, { status: 404 });

    const draws = parseStrictHistory(data.history_data);
    const result = runFormulaByName(draws, formula, { L, targetPos, target2D, scanMode });
    const predictionValues = digitsFromColumns(result.deretLive, kolomHidup);
    const predictionText = formatPrediction(predictionValues, scanMode);

    return NextResponse.json({
      market: data.name,
      latestDraw: result.latestDraw,
      predictionValues,
      predictionText,
      result,
    });
  } catch (error) {
    if (error instanceof HistoryDataFormatError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("[api/saved-trek] Request error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review trek gagal." }, { status: 400 });
  }
}
