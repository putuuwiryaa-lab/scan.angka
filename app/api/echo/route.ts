import { NextResponse } from "next/server";
import { isScanMode, isTarget2D, isTarget3D } from "@/lib/engine/helpers";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import type { Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { runEcho } from "@/lib/echo/engine";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export async function POST(req: Request) {
  const access = await requireActiveAccess(req.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await req.json().catch(() => ({}));
    const marketId = String(body?.marketId || "").trim();
    if (!marketId) return NextResponse.json({ error: "Pilih pasaran dulu." }, { status: 400 });
    if (body?.scanMode !== undefined && !isScanMode(body.scanMode)) return NextResponse.json({ error: "Jenis prediksi tidak valid." }, { status: 400 });
    if (body?.targetPos !== undefined && !isPosisi(body.targetPos)) return NextResponse.json({ error: "Target posisi tidak valid." }, { status: 400 });
    if (body?.target2D !== undefined && !isTarget2D(body.target2D)) return NextResponse.json({ error: "Target 2D tidak valid." }, { status: 400 });
    if (body?.target3D !== undefined && !isTarget3D(body.target3D)) return NextResponse.json({ error: "Target 3D tidak valid." }, { status: 400 });

    const config = {
      targetPos: body?.targetPos as Posisi | undefined,
      target2D: body?.target2D as Target2D | undefined,
      target3D: body?.target3D as Target3D | undefined,
      digitCount: clamp(body?.digitCount, 4, 1, 12),
      stopScan: clamp(body?.stopScan, 3, 1, 20),
      scanMode: (body?.scanMode ?? "ai_2d_belakang") as ScanMode,
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("markets")
      .select("history_data, name")
      .eq("id", marketId)
      .single();

    if (error) {
      console.error("[api/echo] Supabase error", error);
      return NextResponse.json({ error: "Gagal mengambil data pasaran." }, { status: 500 });
    }
    if (!data?.history_data) return NextResponse.json({ error: "Pasaran ini belum punya data keluaran." }, { status: 404 });

    const draws = parseStrictHistory(data.history_data);
    const result = runEcho(draws, config);
    return NextResponse.json({ market: data.name, result });
  } catch (error) {
    if (error instanceof HistoryDataFormatError) return NextResponse.json({ error: error.message }, { status: 422 });
    const message = error instanceof Error ? error.message : "Echo gagal.";
    console.error("[api/echo] Request error", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
