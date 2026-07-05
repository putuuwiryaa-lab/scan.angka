import { NextResponse } from "next/server";
import { requireActiveAccess } from "@/lib/server/access";
import { getSupabase } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function latestResult(historyData: string | null) {
  const list = (historyData ?? "").trim().split(/\s+/).filter((tok) => /^\d{4}$/.test(tok));
  return list.at(-1) ?? null;
}

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("markets")
      .select("id, name, history_data, updated_at")
      .order("order", { ascending: true });

    if (error) {
      console.error("[api/markets] Supabase error", error);
      return NextResponse.json({ error: "Gagal memuat pasaran." }, { status: 500 });
    }

    const rows = data ?? [];
    const markets = rows.map((market) => ({
      id: market.id,
      name: market.name,
      latestResult: latestResult(market.history_data),
      updatedAt: market.updated_at,
    }));
    const syncUpdatedAt = rows
      .map((market) => market.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    return NextResponse.json({ markets, syncUpdatedAt });
  } catch (error) {
    console.error("[api/markets] Request error", error);
    return NextResponse.json({ error: "Gagal memuat pasaran." }, { status: 500 });
  }
}
