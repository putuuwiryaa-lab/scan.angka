import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/server/env";
import { setAdminCookie } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input = String(body.password || "");
  const expected = requireEnv("ADMIN_PASSWORD");

  if (!input || input !== expected) {
    return NextResponse.json({ success: false, error: "Login admin gagal." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  setAdminCookie(response);
  return response;
}
