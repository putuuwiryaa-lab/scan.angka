import { NextResponse } from "next/server";
import { requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);

  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  return NextResponse.json({ ok: true, sessionId: access.sessionId, deviceId: access.deviceId });
}

export async function POST(request: Request) {
  return GET(request);
}
