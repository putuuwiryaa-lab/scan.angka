import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireAdminSession } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  const admin = requireAdminSession(request.headers);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "Dihapus admin").trim().slice(0, 200) || "Dihapus admin";

  if (!id) return NextResponse.json({ error: "Session tidak valid." }, { status: 400 });

  const { error } = await createAdminClient()
    .from("access_sessions")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("id", id)
    .is("revoked_at", null);

  if (error) {
    console.error("ADMIN_SESSION_REVOKE_ERROR", error);
    return NextResponse.json({ error: "Gagal hapus akses." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
