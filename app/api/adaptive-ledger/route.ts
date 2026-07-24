import { NextResponse } from "next/server";
import {
  ADAPTIVE_CHANCE_MODEL_VERSION,
  summarizeChanceBenchmark,
} from "@/lib/movement/chance-benchmark";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;

type SettledPredictionRow = {
  market_id: string;
  output_type: string;
  target: string;
  digit_count: number;
  selected_method: string;
  selected_window: number;
  is_hit: boolean;
  settled_at: string;
  chance_probability: number | null;
  chance_model_version: string | null;
};

type SummaryBucket = {
  total: number;
  hit: number;
  miss: number;
  hitRate: number;
  chance: ReturnType<typeof summarizeChanceBenchmark>;
};

function summarize(rows: SettledPredictionRow[]): SummaryBucket {
  const hit = rows.filter((row) => row.is_hit).length;
  const total = rows.length;
  return {
    total,
    hit,
    miss: total - hit,
    hitRate: total ? Number(((hit / total) * 100).toFixed(2)) : 0,
    chance: summarizeChanceBenchmark(rows.map((row) => ({
      isHit: row.is_hit,
      chanceProbability: row.chance_probability,
    }))),
  };
}

function currentMissStreak(rows: SettledPredictionRow[]): number {
  let streak = 0;
  for (const row of rows) {
    if (row.is_hit) break;
    streak += 1;
  }
  return streak;
}

function groupedSummary(
  rows: SettledPredictionRow[],
  keyOf: (row: SettledPredictionRow) => string,
): Array<SummaryBucket & { key: string }> {
  const groups = new Map<string, SettledPredictionRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const values = groups.get(key) ?? [];
    values.push(row);
    groups.set(key, values);
  }

  return [...groups.entries()]
    .map(([key, values]) => ({ key, ...summarize(values) }))
    .sort((left, right) => right.total - left.total || right.hitRate - left.hitRate || left.key.localeCompare(right.key));
}

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const url = new URL(request.url);
    const marketId = url.searchParams.get("marketId")?.trim() || null;
    const requestedLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(MAX_ROWS, Math.trunc(requestedLimit)))
      : MAX_ROWS;

    const supabase = createAdminClient();
    let settledQuery = supabase
      .from("adaptive_predictions")
      .select("market_id, output_type, target, digit_count, selected_method, selected_window, is_hit, settled_at, chance_probability, chance_model_version")
      .eq("status", "settled")
      .order("settled_at", { ascending: false })
      .limit(limit);

    let pendingQuery = supabase
      .from("adaptive_predictions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    let invalidatedQuery = supabase
      .from("adaptive_predictions")
      .select("id", { count: "exact", head: true })
      .eq("status", "invalidated");

    if (marketId) {
      settledQuery = settledQuery.eq("market_id", marketId);
      pendingQuery = pendingQuery.eq("market_id", marketId);
      invalidatedQuery = invalidatedQuery.eq("market_id", marketId);
    }

    const [settledResponse, pendingResponse, invalidatedResponse] = await Promise.all([
      settledQuery,
      pendingQuery,
      invalidatedQuery,
    ]);

    if (settledResponse.error) throw settledResponse.error;
    if (pendingResponse.error) throw pendingResponse.error;
    if (invalidatedResponse.error) throw invalidatedResponse.error;

    const rows = (settledResponse.data ?? []) as SettledPredictionRow[];
    return NextResponse.json({
      scope: marketId ? { marketId } : { marketId: null },
      sampledSettledRows: rows.length,
      truncated: rows.length === limit,
      pending: pendingResponse.count ?? 0,
      invalidated: invalidatedResponse.count ?? 0,
      chanceBenchmark: {
        modelVersion: ADAPTIVE_CHANCE_MODEL_VERSION,
        publicationGate: false,
        benchmarkedSettledRows: rows.filter((row) => Number.isFinite(Number(row.chance_probability))).length,
        unbenchmarkedSettledRows: rows.filter((row) => !Number.isFinite(Number(row.chance_probability))).length,
      },
      overall: {
        ...summarize(rows),
        currentMissStreak: currentMissStreak(rows),
      },
      byMarket: groupedSummary(rows, (row) => row.market_id),
      byModel: groupedSummary(rows, (row) => `${row.selected_method}:W${row.selected_window}`),
      byConfiguration: groupedSummary(
        rows,
        (row) => `${row.market_id}|${row.output_type}|${row.target}|${row.digit_count}|${row.selected_method}|W${row.selected_window}`,
      ),
    });
  } catch (error) {
    console.error("[api/adaptive-ledger] Request error", error);
    return NextResponse.json({ error: "Gagal memuat performa live Adaptif." }, { status: 500 });
  }
}
