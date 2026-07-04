import { NextResponse } from "next/server";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await verifyActiveTelegramSession(request.headers);

  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  return NextResponse.json(access);
}

export async function POST(request: Request) {
  return GET(request);
}
