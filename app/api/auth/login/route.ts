import { NextResponse } from "next/server";
import { ACCESS_COOKIE, createAccessToken, hasAccessPin, isCorrectPin, normalizePin, SESSION_TTL_SECONDS } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Body = {
  pin?: unknown;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const pin = normalizePin(body.pin);

  if (!hasAccessPin()) {
    return NextResponse.json({ error: "PIN akses belum dikonfigurasi." }, { status: 500 });
  }

  if (!/^\d{8}$/.test(pin) || !isCorrectPin(pin)) {
    return NextResponse.json({ error: "PIN akses salah." }, { status: 401 });
  }

  const token = await createAccessToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
