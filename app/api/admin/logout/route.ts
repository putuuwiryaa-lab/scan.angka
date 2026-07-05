import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAdminCookie(response);
  return response;
}
