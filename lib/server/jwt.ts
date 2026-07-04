import crypto from "crypto";
import { requireEnv } from "./env";

export const TOKEN_VERSION = Number(process.env.TOKEN_VERSION || 2);
export const SCAN_TOKEN_COOKIE = "aa_scan_token";
export const SCAN_DEVICE_COOKIE = "aa_device_id";

export type Role = "TRIAL" | "PRO" | "SUPER";

export type TokenPayload = {
  role: Role;
  accountId: string;
  sessionId: string;
  tokenVersion: number;
  iat: number;
  exp: number;
  appKey?: string;
  deviceHash?: string;
  userAgentHash?: string;
};

type SignInput = Omit<TokenPayload, "tokenVersion" | "iat" | "exp"> & {
  tokenVersion?: number;
};

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function sign(input: string): string {
  return crypto
    .createHmac("sha256", requireEnv("JWT_SECRET"))
    .update(input)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signToken(payload: SignInput, maxAgeSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      tokenVersion: payload.tokenVersion ?? TOKEN_VERSION,
      iat: now,
      exp: now + Math.max(60, Math.trunc(maxAgeSeconds)),
    }),
  );
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifyToken(token: string): TokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(base64UrlDecode(body)) as TokenPayload;
  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp < now) throw new Error("Token expired");
  if (payload.iat && payload.iat > now + 60) throw new Error("Token issued in future");

  return payload;
}

function cookieValue(headers: Headers, name: string): string {
  const cookieHeader = headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const prefix = `${name}=`;
  const match = cookies.find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

export function getCookieValue(headers: Headers, name: string): string {
  return cookieValue(headers, name);
}

export function getBearerToken(headers: Headers): string {
  const authorization = headers.get("authorization") || "";
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];
  return token || cookieValue(headers, SCAN_TOKEN_COOKIE);
}
