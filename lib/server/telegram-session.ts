import crypto from "crypto";
import { createAdminClient } from "./supabase-admin";
import { requireEnv } from "./env";
import {
  getBearerToken,
  getCookieValue,
  SCAN_DEVICE_COOKIE,
  TOKEN_VERSION,
  verifyToken,
  type Role,
} from "./jwt";

const DEVICE_HEADER = "x-aa-device-id";
const APP_KEY = "scan";

type TelegramPlan = "NONE" | "TRIAL" | "PRO";
type AccessRole = Extract<Role, "TRIAL" | "PRO" | "SUPER">;

type TelegramUserRow = {
  id: string;
  telegram_user_id: number;
  plan: TelegramPlan;
  trial_expires_at: string | null;
  pro_expires_at: string | null;
  is_active: boolean;
  suspended_at: string | null;
};

type AppSessionRow = {
  session_id: string;
  app_key: string;
  device_hash: string | null;
  user_agent_hash: string | null;
  expires_at: string | null;
};

export type TelegramSessionResult =
  | {
      ok: true;
      role: AccessRole;
      accountId: string;
      telegramUserId: number;
      expiresAt: string;
      sessionId: string;
      deviceBound: boolean;
    }
  | { ok: false; status: number; error: string };

function isFutureDate(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function normalizeDeviceId(value: string | null) {
  return String(value || "").trim().slice(0, 120);
}

function hashValue(value: string) {
  return crypto.createHmac("sha256", requireEnv("JWT_SECRET")).update(value).digest("hex");
}

function tokenExpiresAt(exp?: number) {
  return typeof exp === "number"
    ? new Date(exp * 1000).toISOString()
    : "9999-12-31T00:00:00.000Z";
}

function activeExpiryForRole(role: AccessRole, user: TelegramUserRow): string | null {
  if (role === "PRO") return user.pro_expires_at;
  if (role === "TRIAL") return user.trial_expires_at;
  return tokenExpiresAt();
}

export async function verifyActiveTelegramSession(headers: Headers): Promise<TelegramSessionResult> {
  const token = getBearerToken(headers);

  if (!token || token === "null" || token === "undefined") {
    return { ok: false, status: 401, error: "Silakan login terlebih dahulu." };
  }

  const userAgentHash = hashValue(headers.get("user-agent") || "unknown");
  const deviceId = normalizeDeviceId(headers.get(DEVICE_HEADER) || getCookieValue(headers, SCAN_DEVICE_COOKIE));
  const deviceHash = deviceId ? hashValue(deviceId) : "";

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return { ok: false, status: 401, error: "Session tidak valid. Silakan login ulang." };
  }

  if (payload.tokenVersion !== TOKEN_VERSION) {
    return { ok: false, status: 401, error: "Session lama. Silakan login ulang." };
  }

  if (payload.appKey && payload.appKey !== APP_KEY) {
    return { ok: false, status: 403, error: "Session bukan untuk Scan Angka." };
  }

  const role = String(payload.role || "") as AccessRole;
  if (role !== "TRIAL" && role !== "PRO" && role !== "SUPER") {
    return { ok: false, status: 403, error: "Akses tidak valid." };
  }

  const accountId = String(payload.accountId || "");
  const sessionId = String(payload.sessionId || "");

  if (!accountId || !sessionId) {
    return { ok: false, status: 401, error: "Session tidak lengkap. Silakan login ulang." };
  }

  if (role === "SUPER") {
    const tokenDeviceHash = String(payload.deviceHash || "");
    const tokenUserAgentHash = String(payload.userAgentHash || "");

    if (tokenDeviceHash && (!deviceHash || tokenDeviceHash !== deviceHash)) {
      return { ok: false, status: 401, error: "Akun sedang aktif di device lain. Silakan login ulang." };
    }

    if (!tokenDeviceHash && tokenUserAgentHash && tokenUserAgentHash !== userAgentHash) {
      return { ok: false, status: 401, error: "Device tidak valid. Silakan login ulang." };
    }

    return {
      ok: true,
      role: "SUPER",
      accountId,
      telegramUserId: 0,
      expiresAt: tokenExpiresAt(payload.exp),
      sessionId,
      deviceBound: Boolean(tokenDeviceHash),
    };
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("telegram_users")
    .select("id, telegram_user_id, plan, trial_expires_at, pro_expires_at, is_active, suspended_at")
    .eq("id", accountId)
    .maybeSingle<TelegramUserRow>();

  if (error) return { ok: false, status: 500, error: "Gagal memeriksa session." };
  if (!user) return { ok: false, status: 401, error: "Akun tidak ditemukan. Silakan login ulang." };
  if (!user.is_active || user.suspended_at) return { ok: false, status: 403, error: "Akun sedang tidak aktif." };

  const expiresAt = activeExpiryForRole(role, user);
  if (!isFutureDate(expiresAt)) return { ok: false, status: 403, error: "Masa akses sudah habis." };

  const { data: appSession, error: sessionError } = await supabase
    .from("telegram_app_sessions")
    .select("session_id, app_key, device_hash, user_agent_hash, expires_at")
    .eq("user_id", user.id)
    .eq("app_key", APP_KEY)
    .maybeSingle<AppSessionRow>();

  if (sessionError) {
    return { ok: false, status: 500, error: "Gagal memeriksa session aplikasi." };
  }

  if (!appSession || appSession.session_id !== sessionId) {
    return { ok: false, status: 401, error: "Session Scan Angka sudah diganti perangkat lain. Silakan login ulang." };
  }

  if (!isFutureDate(appSession.expires_at)) {
    return { ok: false, status: 403, error: "Session Scan Angka sudah habis." };
  }

  if (appSession.device_hash && !deviceHash && appSession.user_agent_hash !== userAgentHash) {
    return { ok: false, status: 401, error: "Device tidak valid. Silakan login ulang." };
  }

  if (appSession.device_hash && deviceHash && appSession.device_hash !== deviceHash) {
    return { ok: false, status: 401, error: "Akun sedang aktif di device lain. Silakan login ulang." };
  }

  return {
    ok: true,
    role,
    accountId,
    telegramUserId: user.telegram_user_id,
    expiresAt: expiresAt as string,
    sessionId,
    deviceBound: Boolean(appSession.device_hash),
  };
}
