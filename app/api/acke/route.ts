import { NextResponse } from "next/server";
import { clampRounds, runAckeAnalysis } from "@/lib/engine/acke-engine";
import type { AckeRequest, FormulaCode, PositionCode } from "@/lib/engine/types";
import { createSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPositionCode(value: unknown): value is PositionCode {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function isFormulaCode(value: unknown): value is FormulaCode {
  return typeof value === "string" && /^[ACKE][1-9]$/.test(value.toUpperCase());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<AckeRequest>;
    const marketId = String(body.marketId || "").trim();
    const target = String(body.target || "").trim().toUpperCase();
    const formula = String(body.formula || "").trim().toUpperCase();
    const rounds = clampRounds(body.rounds);

    if (!marketId || !isPositionCode(target) || !isFormulaCode(formula)) {
      return NextResponse.json({ error: "Request tidak valid." }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("markets")
      .select("id,name,history_data,order,updated_at")
      .eq("id", marketId)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Pasaran tidak ditemukan." }, { status: 404 });
    }

    const result = runAckeAnalysis({
      market: data,
      target,
      formula,
      rounds,
    });

    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menghitung ACKE.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
