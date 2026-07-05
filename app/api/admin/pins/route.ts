import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { formatPin, generatePin, hashPin, requireAdminSession } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PinViewRow = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
  used_at: string | null;
  revoked_at: string | null;
  used_session_id: string | null;
  device_name: string | null;
  device_id: string | null;
  session_created_at: string | null;
  last_seen_at: string | null;
  session_revoked_at: string | null;
};

export async function GET(request: Request) {
  const admin = requireAdminSession(request.headers);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { data, error } = await createAdminClient()
    .from("admin_access_pins_view")
    .select("id, status, note, created_at, used_at, revoked_at, used_session_id, device_name, device_id, session_created_at, last_seen_at, session_revoked_at")
    .limit(100);

  if (error) {
    console.error("ADMIN_PINS_LIST_ERROR", error);
    return NextResponse.json({ error: "Gagal memuat PIN." }, { status: 500 });
  }

  return NextResponse.json({ pins: (data ?? []) as PinViewRow[] });
}

export async function POST(request: Request) {
  const admin = requireAdminSession(request.headers);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => ({}));
  const note = String(body.note || "").trim().slice(0, 200) || null;
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const pin = generatePin();
    const { error } = await supabase
      .from("access_pins")
      .insert({ pin_hash: hashPin(pin), status: "unused", note });

    if (!error) {
      return NextResponse.json({ success: true, pin: formatPin(pin) });
    }

    if (!/duplicate key|unique/i.test(error.message || "")) {
      console.error("ADMIN_PIN_CREATE_ERROR", error);
      return NextResponse.json({ error: "Gagal membuat PIN." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Gagal membuat PIN unik." }, { status: 500 });
}
