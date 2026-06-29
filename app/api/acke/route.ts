import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { runEngineFromHistory } from "@/lib/engine/acke-engine";
import type { Posisi } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

function clampL(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 15;
  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { marketId, patokanPos, patokanN, targetPos, L } = body ?? {};

    if (!marketId) {
      return NextResponse.json({ error: "Pilih pasaran dulu." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("markets")
      .select("history_data, name")
      .eq("id", marketId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data?.history_data) {
      return NextResponse.json(
        { error: "Pasaran ini belum punya data keluaran." },
        { status: 404 }
      );
    }

    const result = runEngineFromHistory(data.history_data, {
      patokanPos: patokanPos as Posisi,
      patokanN: Number(patokanN),
      targetPos: targetPos as Posisi,
      L: clampL(L),
    });

    return NextResponse.json({ market: data.name, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Terjadi kesalahan.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
