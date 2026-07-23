import { NextResponse } from "next/server";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import { runMovementEngine } from "@/lib/movement/engine";
import {
  isMovementOutputType,
  isMovementTarget,
  type MovementConfig,
} from "@/lib/movement/types";
import { requireActiveAccess } from "@/lib/server/access";
import {
  recordAdaptivePredictionSafely,
  settleAdaptivePredictionsSafely,
} from "@/lib/server/adaptive-ledger";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digitCountOf(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(1, Math.min(9, Math.trunc(parsed)));
}

export async function POST(req: Request) {
  const access = await requireActiveAccess(req.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await req.json().catch(() => ({}));
    const marketId = String(body?.marketId || "").trim();
    if (!marketId) return NextResponse.json({ error: "Pilih pasaran dulu." }, { status: 400 });
    if (!isMovementOutputType(body?.outputType)) {
      return NextResponse.json({ error: "Jenis output tidak valid." }, { status: 400 });
    }
    if (!isMovementTarget(body?.target)) {
      return NextResponse.json({ error: "Target analisa tidak valid." }, { status: 400 });
    }

    const config: MovementConfig = {
      outputType: body.outputType,
      target: body.target,
      digitCount: digitCountOf(body?.digitCount),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("markets")
      .select("history_data, name")
      .eq("id", marketId)
      .single();

    if (error) {
      console.error("[api/movement] Supabase error", error);
      return NextResponse.json({ error: "Gagal mengambil data pasaran." }, { status: 500 });
    }
    if (!data?.history_data) {
      return NextResponse.json({ error: "Pasaran ini belum punya data keluaran." }, { status: 404 });
    }

    const draws = parseStrictHistory(data.history_data);
    await settleAdaptivePredictionsSafely(supabase, marketId, draws);

    const result = runMovementEngine(draws, config);
    await recordAdaptivePredictionSafely(supabase, marketId, result, "movement");

    return NextResponse.json({ market: data.name, result });
  } catch (error) {
    if (error instanceof HistoryDataFormatError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Analisa pergerakan gagal.";
    console.error("[api/movement] Request error", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
