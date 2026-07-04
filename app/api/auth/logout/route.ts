import { NextResponse } from "next/server";
import { SCAN_DEVICE_COOKIE, SCAN_TOKEN_COOKIE } from "@/lib/server/jwt";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  for (const cookie of [SCAN_TOKEN_COOKIE, SCAN_DEVICE_COOKIE]) {
    response.cookies.set(cookie, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
