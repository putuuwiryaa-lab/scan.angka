import { NextResponse } from "next/server";
import { clearAccessCookies, requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers, { touch: false });

  if (access.ok) {
    const response = NextResponse.json({ active: true });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const response = NextResponse.json(
    { active: false, error: access.error },
    { status: access.status },
  );
  response.headers.set("Cache-Control", "no-store");

  if (access.status === 401 || access.status === 403) {
    clearAccessCookies(response);
  }

  return response;
}
