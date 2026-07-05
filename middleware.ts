import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "scan_access_token";
const ADMIN_COOKIE = "scan_admin_session";

const PUBLIC_PATHS = new Set([
  "/pin",
  "/admin/login",
  "/api/pin/activate",
  "/api/admin/login",
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
  const hasAccess = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);
  const hasAdmin = Boolean(req.cookies.get(ADMIN_COOKIE)?.value);

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin/")) {
    if (hasAdmin) return NextResponse.next();
    return NextResponse.json({ error: "Admin belum login." }, { status: 401 });
  }

  if (pathname.startsWith("/admin")) {
    if (hasAdmin) return NextResponse.next();
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/")) {
    if (hasAccess) return NextResponse.next();
    return NextResponse.json({ error: "Silakan masukkan PIN akses." }, { status: 401 });
  }

  if (hasAccess) return NextResponse.next();

  const pinUrl = new URL("/pin", req.url);
  pinUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(pinUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
