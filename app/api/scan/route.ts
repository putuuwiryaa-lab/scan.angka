import { NextResponse } from "next/server";
import { runAutoScan } from "@/lib/engine/acke-engine";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import { isScanMode, isTarget2D, isTarget3D } from "@/lib/engine/helpers";
import type { Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { getSupabase } from "@/lib/supabase/client";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DIGIT_COUNT = 4;
const DEFAULT_SCAN_MODE: ScanMode = "ai_2d_belakang";
const DEFAULT_STOP_SCAN = 1;

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export async function POST(req: Request) {
  const access = await verifyActiveTelegramSession(req.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await req.json().catch(() => ({}));
    const marketId = String(body?.marketId || "").trim();

    if (!marketId) {
      return NextResponse.json({ error: "Pilih pasaran dulu." }, { status: 400 });
    }

    if (body?.scanMode !== undefined && !isScanMode(body.scanMode)) {
      return NextResponse.json({ error: "Jenis scan tidak valid." }, { status: 400 });
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

    const config = {
      L: clamp(body?.L, 14, 1, 100),
      targetPos: body?.targetPos as Posisi | undefined,
      target2D: body?.target2D as Target2D | undefined,
      target3D: body?.target3D as Target3D | undefined,
      digitCount: clamp(body?.digitCount ?? body?.minHidup, DEFAULT_DIGIT_COUNT, 1, 12),
      stopScan: clamp(body?.stopScan, DEFAULT_STOP_SCAN, 1, 200),
      scanMode: (body?.scanMode ?? DEFAULT_SCAN_MODE) as ScanMode,
    };

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("markets")
      .select("history_data, name")
      .eq("id", marketId)
      .single();

    if (error) {
      console.error("[api/scan] Supabase error", error);
      return NextResponse.json({ error: "Gagal mengambil data pasaran." }, { status: 500 });
    }
    if (!data?.history_data) {
      return NextResponse.json({ error: "Pasaran ini belum punya data keluaran." }, { status: 404 });
    }

    const draws = parseStrictHistory(data.history_data);
    const result = runAutoScan(draws, config);
    return NextResponse.json({ market: data.name, result });
  } catch (error) {
    if (error instanceof HistoryDataFormatError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("[api/scan] Request error", error);
    return NextResponse.json({ error: "Scan gagal." }, { status: 400 });
  }
}
