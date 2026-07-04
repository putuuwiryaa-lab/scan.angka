import { NextRequest, NextResponse } from "next/server";

const SCAN_TOKEN_COOKIE = "aa_scan_token";

const PUBLIC_PATHS = new Set([
  "/kode-login",
  "/login",
  "/api/code-login",
  "/api/auth/logout",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.ico",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  return /\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|txt|xml)$/i.test(pathname);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SCAN_TOKEN_COOKIE)?.value);

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(`/kode-login${search}`, req.url));
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/kode-login" && hasSession) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const loginUrl = new URL("/kode-login", req.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
