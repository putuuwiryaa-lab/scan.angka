import { NextResponse } from "next/server";
import { runAutoScanFromHistory } from "@/lib/engine/acke-engine";
import type { Posisi, ScanMode } from "@/lib/engine/types";
import { getSupabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

const DEFAULT_DIGIT_COUNT = 7;

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function isScanMode(value: unknown): value is ScanMode {
  return value === "posisi" || value === "ai_2d_belakang" || value === "bbfs_2d_belakang";
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export async function POST(req: Request) {
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

    const config = {
      L: clamp(body?.L, 14, 1, 100),
      targetPos: body?.targetPos as Posisi | undefined,
      digitCount: clamp(body?.digitCount ?? body?.minHidup, DEFAULT_DIGIT_COUNT, 1, 9),
      stopScan: clamp(body?.stopScan, 3, 1, 200),
      scanMode: (body?.scanMode ?? "posisi") as ScanMode,
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

    const result = runAutoScanFromHistory(data.history_data, config);
    return NextResponse.json({ market: data.name, result });
  } catch (error) {
    console.error("[api/scan] Request error", error);
    return NextResponse.json({ error: "Scan gagal." }, { status: 400 });
  }
}
