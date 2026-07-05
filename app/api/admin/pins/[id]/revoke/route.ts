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
  if (!id) return NextResponse.json({ error: "PIN tidak valid." }, { status: 400 });

  const { error } = await createAdminClient()
    .from("access_pins")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "unused");

  if (error) {
    console.error("ADMIN_PIN_REVOKE_ERROR", error);
    return NextResponse.json({ error: "Gagal membatalkan PIN." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
