import { NextResponse } from "next/server";
import { runAutoScanFromHistory } from "@/lib/engine/acke-engine";
import type { Posisi, ScanMode } from "@/lib/engine/types";
import { getSupabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type MarketRow = {
  id: string;
  name: string | null;
  history_data: string | null;
};

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

function title(mode: ScanMode, targetPos: Posisi, digitCount: number) {
  if (mode === "ai_2d_belakang") return `AI ${digitCount}D Belakang`;
  if (mode === "bbfs_2d_belakang") return `BBFS ${digitCount}D Belakang`;
  const label: Record<Posisi, string> = { A: "As", C: "Cop", K: "Kepala", E: "Ekor" };
  return `${label[targetPos]} ${digitCount}D`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const marketIds = Array.isArray(body?.marketIds)
      ? body.marketIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      : [];

    if (marketIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal 1 pasaran." }, { status: 400 });
    }

    const mode = scanMode(body?.scanMode);
    const targetPos = isPosisi(body?.targetPos) ? body.targetPos : "K";
    const digitCount = clamp(body?.digitCount, 7, 1, 9);
    const L = clamp(body?.L, 15, 1, 100);
    const outputTitle = title(mode, targetPos, digitCount);

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("markets")
      .select("id, name, history_data")
      .in("id", marketIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const byId = new Map<string, MarketRow>((data ?? []).map((market) => [market.id, market]));
    const results = marketIds.map((id) => {
      const market = byId.get(id);
      const name = market?.name ?? id;
      if (!market?.history_data) {
        return { id, name, digits: "-" };
      }

      try {
        const result = runAutoScanFromHistory(market.history_data, {
          L,
          targetPos,
          digitCount,
          stopScan: 1,
          scanMode: mode,
        });
        const digits = result.items[0]?.angkaHidup.join("") || "-";
        return { id, name, digits };
      } catch {
        return { id, name, digits: "-" };
      }
    });

    const lines = results.map((item) => `${item.name} ⟢ ${item.digits}`);
    const copyText = [outputTitle, "", ...lines].join("\n");

    return NextResponse.json({ title: outputTitle, results, lines, copyText });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Batch scan gagal.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
