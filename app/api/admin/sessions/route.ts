import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireAdminSession } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionViewRow = {
  id: string;
  pin_id: string | null;
  device_id: string | null;
  device_name: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  status: string;
  pin_note: string | null;
};

export async function GET(request: Request) {
  const admin = requireAdminSession(request.headers);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { data, error } = await createAdminClient()
    .from("admin_access_sessions_view")
    .select("id, pin_id, device_id, device_name, user_agent, created_at, last_seen_at, revoked_at, revoked_reason, status, pin_note")
    .limit(100);

  if (error) {
    console.error("ADMIN_SESSIONS_LIST_ERROR", error);
    return NextResponse.json({ error: "Gagal memuat session." }, { status: 500 });
  }

  return NextResponse.json({ sessions: (data ?? []) as SessionViewRow[] });
}
