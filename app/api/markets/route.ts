import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("markets")
      .select("id, name")
      .order("order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ markets: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat pasaran.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
