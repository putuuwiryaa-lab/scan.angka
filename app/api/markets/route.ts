import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { parseHistoryData } from "@/lib/engine/acke-engine";
import type { Market } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarketResponse = Market & {
  total_results: number;
  last_result: string | null;
};

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("markets")
      .select("id,name,history_data,order,updated_at")
      .order("order", { ascending: true, nullsFirst: false });

    if (error) throw error;

    const markets: MarketResponse[] = (data || []).map((market) => {
      const history = parseHistoryData(market.history_data);
      return {
        id: String(market.id),
        name: market.name,
        history_data: market.history_data,
        order: market.order,
        updated_at: market.updated_at,
        total_results: history.length,
        last_result: history.length ? history[history.length - 1] : null,
      };
    });

    return NextResponse.json({ markets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat pasaran.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
