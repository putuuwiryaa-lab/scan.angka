import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "./supabase-admin";
import { requireEnv } from "./env";
import { getClientIp } from "./http";

export const ACCESS_COOKIE = "scan_access_token";
export const DEVICE_COOKIE = "scan_device_id";
export const ADMIN_COOKIE = "scan_admin_session";

const USER_MAX_AGE = 60 * 60 * 24 * 365 * 10;
const ADMIN_MAX_AGE = 60 * 60 * 24 * 7;

type AccessSessionRow = {
  id: string;
  device_id: string | null;
  revoked_at: string | null;
};

export type AccessResult =
  | { ok: true; sessionId: string; deviceId: string | null }
  | { ok: false; status: number; error: string };

function secret() {
  return requireEnv("ACCESS_SECRET");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hmac(value: string, purpose: string) {
  return crypto.createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("hex");
}

export function normalizePin(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

export function formatPin(pin: string) {
  const clean = normalizePin(pin);
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function generatePin() {
  return String(crypto.randomInt(0, 100_000_000)).padStart(8, "0");
}

export function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPin(pin: string) {
  return hmac(normalizePin(pin), "pin");
}

export function hashSessionToken(token: string) {
  return hmac(token, "session");
}

export function hashIp(ip: string) {
  return hmac(ip || "unknown", "ip");
}

export function parseCookie(headers: Headers, name: string) {
  const cookieHeader = headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const prefix = `${name}=`;
  const match = cookies.find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

export function setAccessCookies(response: NextResponse, token: string, deviceId: string) {
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_MAX_AGE,
  });

  response.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_MAX_AGE,
  });
}

export function clearAccessCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(DEVICE_COOKIE, "", { path: "/", maxAge: 0 });
}

export function createAdminSessionToken() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const signature = hmac(`${issuedAt}:${requireEnv("ADMIN_PASSWORD")}`, "admin-session");
  return `${issuedAt}.${signature}`;
}

export function isAdminSessionValid(headers: Headers) {
  const token = parseCookie(headers, ADMIN_COOKIE);
  const [issuedAtRaw, signature] = token.split(".");
  const issuedAt = Number(issuedAtRaw);

  if (!issuedAt || !signature) return false;
  if (Math.floor(Date.now() / 1000) - issuedAt > ADMIN_MAX_AGE) return false;

  const expected = hmac(`${issuedAt}:${requireEnv("ADMIN_PASSWORD")}`, "admin-session");
  return safeEqual(signature, expected);
}

export function requireAdminSession(headers: Headers) {
  if (!isAdminSessionValid(headers)) {
    return { ok: false as const, status: 401, error: "Admin belum login." };
  }

  return { ok: true as const };
}

export function setAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function requireActiveAccess(headers: Headers): Promise<AccessResult> {
  const token = parseCookie(headers, ACCESS_COOKIE);
  const deviceId = parseCookie(headers, DEVICE_COOKIE);

  if (!token) {
    return { ok: false, status: 401, error: "Silakan masukkan PIN akses." };
  }

  const tokenHash = hashSessionToken(token);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("access_sessions")
    .select("id, device_id, revoked_at")
    .eq("session_token_hash", tokenHash)
    .maybeSingle<AccessSessionRow>();

  if (error) {
    console.error("ACCESS_SESSION_CHECK_ERROR", error);
    return { ok: false, status: 500, error: "Gagal memeriksa akses." };
  }

  if (!data) {
    return { ok: false, status: 401, error: "Session tidak valid. Masukkan PIN baru." };
  }

  if (data.revoked_at) {
    return { ok: false, status: 403, error: "Akses sudah dinonaktifkan admin." };
  }

  if (data.device_id && deviceId && data.device_id !== deviceId) {
    return { ok: false, status: 401, error: "Session tidak cocok dengan device ini." };
  }

  await supabase
    .from("access_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return { ok: true, sessionId: data.id, deviceId: data.device_id };
}

export function requestMeta(request: Request) {
  const userAgent = request.headers.get("user-agent") || "unknown";
  const ip = getClientIp(request.headers);
  return { userAgent, ipHash: hashIp(ip) };
}
