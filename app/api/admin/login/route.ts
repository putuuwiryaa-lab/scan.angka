import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/server/env";
import { requestMeta, setAdminCookie } from "@/lib/server/access";
import { clearRateLimit, consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_SCOPE = "admin-login";

function rateLimitedResponse(retryAfter: number) {
  const response = NextResponse.json(
    { success: false, error: "Terlalu banyak percobaan login. Coba lagi nanti." },
    { status: 429 },
  );
  response.headers.set("Retry-After", String(Math.max(1, retryAfter)));
  return response;
}

export async function POST(request: Request) {
  try {
    const { ipHash } = requestMeta(request);
    const rateLimit = await consumeRateLimit({
      scope: RATE_LIMIT_SCOPE,
      keyHash: ipHash,
      limit: 5,
      windowSeconds: 15 * 60,
      blockSeconds: 30 * 60,
    });

    if (!rateLimit.allowed) {
      return rateLimitedResponse(rateLimit.retryAfter);
    }

    const body = await request.json().catch(() => ({}));
    const input = String(body.password || "");
    const expected = requireEnv("ADMIN_PASSWORD");

    if (!input || input !== expected) {
      return NextResponse.json({ success: false, error: "Login admin gagal." }, { status: 401 });
    }

    clearRateLimit(RATE_LIMIT_SCOPE, ipHash).catch((error) => {
      console.error("ADMIN_RATE_LIMIT_CLEAR_ERROR", error);
    });

    const response = NextResponse.json({ success: true });
    setAdminCookie(response);
    return response;
  } catch (error) {
    console.error("ADMIN_LOGIN_ERROR", error);
    return NextResponse.json(
      { success: false, error: "Layanan login admin sementara tidak tersedia." },
      { status: 503 },
    );
  }
}
