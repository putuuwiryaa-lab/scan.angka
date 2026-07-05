import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import {
  generateToken,
  hashPin,
  hashSessionToken,
  normalizePin,
  requestMeta,
  setAccessCookies,
} from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PinRow = {
  id: string;
  status: "unused" | "used" | "revoked";
};

function normalizeDeviceId(value: unknown) {
  return String(value || "").trim().slice(0, 120);
}

function normalizeDeviceName(value: unknown) {
  return String(value || "").trim().slice(0, 160) || "Unknown Device";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pin = normalizePin(body.pin);
  const deviceId = normalizeDeviceId(body.device_id);
  const deviceName = normalizeDeviceName(body.device_name);

  if (pin.length !== 8) {
    return NextResponse.json({ success: false, error: "PIN harus 8 digit." }, { status: 400 });
  }

  if (!deviceId) {
    return NextResponse.json({ success: false, error: "Device tidak valid." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const pinHash = hashPin(pin);
    const { userAgent, ipHash } = requestMeta(request);

    const { data: pinRow, error: pinError } = await supabase
      .from("access_pins")
      .select("id, status")
      .eq("pin_hash", pinHash)
      .maybeSingle<PinRow>();

    if (pinError) throw pinError;

    if (!pinRow) {
      return NextResponse.json({ success: false, error: "PIN tidak valid." }, { status: 401 });
    }

    if (pinRow.status === "used") {
      return NextResponse.json({ success: false, error: "PIN sudah digunakan." }, { status: 409 });
    }

    if (pinRow.status === "revoked") {
      return NextResponse.json({ success: false, error: "PIN sudah dibatalkan admin." }, { status: 403 });
    }

    const token = generateToken();
    const tokenHash = hashSessionToken(token);
    const now = new Date().toISOString();

    const { data: sessionRow, error: sessionError } = await supabase
      .from("access_sessions")
      .insert({
        pin_id: pinRow.id,
        session_token_hash: tokenHash,
        device_id: deviceId,
        device_name: deviceName,
        user_agent: userAgent,
        ip_hash: ipHash,
        created_at: now,
        last_seen_at: now,
      })
      .select("id")
      .single<{ id: string }>();

    if (sessionError) throw sessionError;

    const { data: usedPin, error: useError } = await supabase
      .from("access_pins")
      .update({ status: "used", used_at: now, used_session_id: sessionRow.id })
      .eq("id", pinRow.id)
      .eq("status", "unused")
      .select("id")
      .maybeSingle<{ id: string }>();

    if (useError) throw useError;

    if (!usedPin) {
      await supabase.from("access_sessions").delete().eq("id", sessionRow.id);
      return NextResponse.json({ success: false, error: "PIN sudah digunakan. Minta PIN baru." }, { status: 409 });
    }

    const response = NextResponse.json({ success: true });
    setAccessCookies(response, token, deviceId);
    return response;
  } catch (error) {
    console.error("PIN_ACTIVATE_ERROR", error);
    return NextResponse.json({ success: false, error: "Gagal aktivasi PIN." }, { status: 500 });
  }
}
