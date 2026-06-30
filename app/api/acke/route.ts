import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { runEngineFromHistory } from "@/lib/engine/acke-engine";
import type { Posisi } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function clampL(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 15;
  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

function parsePatokanN(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) return null;
  return parsed;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { marketId, patokanPos, patokanN, targetPos, L } = body ?? {};

    if (!marketId) {
      return NextResponse.json({ error: "Pilih pasaran dulu." }, { status: 400 });
    }

    if (!isPosisi(patokanPos) || !isPosisi(targetPos)) {
      return NextResponse.json({ error: "Posisi tidak valid." }, { status: 400 });
    }

    const safePatokanN = parsePatokanN(patokanN);
    if (!safePatokanN) {
      return NextResponse.json({ error: "Patokan N tidak valid." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("markets")
      .select("history_data, name")
      .eq("id", marketId)
      .single();

    if (error) {
      console.error("[api/acke] Supabase error", error);
      return NextResponse.json({ error: "Gagal mengambil data pasaran." }, { status: 500 });
    }
    if (!data?.history_data) {
      return NextResponse.json(
        { error: "Pasaran ini belum punya data keluaran." },
        { status: 404 }
      );
    }

    const result = runEngineFromHistory(data.history_data, {
      patokanPos,
      patokanN: safePatokanN,
      targetPos,
      L: clampL(L),
    });

    return NextResponse.json({ market: data.name, result });
  } catch (error) {
    console.error("[api/acke] Request error", error);
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 400 });
  }
}
