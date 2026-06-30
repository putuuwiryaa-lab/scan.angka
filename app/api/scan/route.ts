import { NextResponse } from "next/server";
import { runAutoScanFromHistory } from "@/lib/engine/acke-engine";
import type { Posisi, ScanMode } from "@/lib/engine/types";
import { getSupabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function scanMode(value: unknown): ScanMode {
  if (value === "ai_2d_belakang" || value === "bbfs_2d_belakang") return value;
  return "posisi";
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

    const target = isPosisi(body?.targetPos) ? body.targetPos : undefined;
    const config = {
      L: clamp(body?.L, 14, 1, 100),
      targetPos: target,
      digitCount: clamp(body?.digitCount ?? body?.minHidup, 3, 1, 9),
      stopScan: clamp(body?.stopScan, 3, 1, 200),
      scanMode: scanMode(body?.scanMode),
    };

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("markets")
      .select("history_data, name")
      .eq("id", marketId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.history_data) {
      return NextResponse.json({ error: "Pasaran ini belum punya data keluaran." }, { status: 404 });
    }

    const result = runAutoScanFromHistory(data.history_data, config);
    return NextResponse.json({ market: data.name, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Scan gagal.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
