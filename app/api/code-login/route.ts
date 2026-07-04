import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireEnv } from "@/lib/server/env";
import { signToken, SCAN_DEVICE_COOKIE, SCAN_TOKEN_COOKIE, type Role } from "@/lib/server/jwt";
import { getClientIp } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_KEY = "scan";
const TRIAL_DAYS = 14;
const SUPER_ACCESS_DAYS = 3650;

type TelegramUserRow = {
  id: string;
  telegram_user_id: number;
  chat_id: number | null;
  plan: "NONE" | "TRIAL" | "PRO";
  trial_used: boolean;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  pro_started_at: string | null;
  pro_expires_at: string | null;
  is_active: boolean;
  suspended_at: string | null;
};

type LoginCodeRow = {
  id: string;
  user_id: string;
  telegram_user_id: number;
  chat_id: number | null;
  code_type: "LOGIN" | "TRIAL_LOGIN" | "PRO_LOGIN";
  expires_at: string;
  used_at: string | null;
  consumed_session_id: string | null;
};

function getCodeSecret() {
  return process.env.TELEGRAM_LOGIN_CODE_SECRET || requireEnv("TELEGRAM_WEBHOOK_SECRET");
}

function hashValue(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function hashLoginCode(code: string) {
  return crypto.createHash("sha256").update(`${getCodeSecret()}:${code}`).digest("hex");
}

function normalizeCode(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function normalizeDeviceId(value: unknown) {
  return String(value || "").trim().slice(0, 120);
}

function isFutureDate(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function secondsUntil(value: string) {
  const seconds = Math.floor((new Date(value).getTime() - Date.now()) / 1000);
  return Math.max(seconds, 60);
}

function activeRoleAndExpiry(user: TelegramUserRow): { role: Role; expiresAt: string } | null {
  if (user.plan === "PRO" && isFutureDate(user.pro_expires_at)) {
    return { role: "PRO", expiresAt: user.pro_expires_at as string };
  }

  if (user.plan === "TRIAL" && isFutureDate(user.trial_expires_at)) {
    return { role: "TRIAL", expiresAt: user.trial_expires_at as string };
  }

  return null;
}

async function writeAccessEvent(params: {
  userId?: string | null;
  telegramUserId?: number | null;
  chatId?: number | null;
  eventType: string;
  eventDetail?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  userAgentHash?: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("telegram_access_events").insert({
    user_id: params.userId || null,
    telegram_user_id: params.telegramUserId || null,
    chat_id: params.chatId || null,
    event_type: params.eventType,
    event_detail: params.eventDetail || null,
    metadata: { app_key: APP_KEY, ...(params.metadata || {}) },
    ip_hash: params.ipHash || null,
    user_agent_hash: params.userAgentHash || null,
  });

  if (error) console.error("TELEGRAM_ACCESS_EVENT_ERROR", error);
}

async function failLogin(params: {
  status?: number;
  error: string;
  reason: string;
  code?: LoginCodeRow | null;
  ipHash: string;
  userAgentHash: string;
}) {
  await writeAccessEvent({
    userId: params.code?.user_id || null,
    telegramUserId: params.code?.telegram_user_id || null,
    chatId: params.code?.chat_id || null,
    eventType: "SCAN_LOGIN_FAILED",
    eventDetail: params.reason,
    metadata: { reason: params.reason },
    ipHash: params.ipHash,
    userAgentHash: params.userAgentHash,
  });

  return NextResponse.json(
    { success: false, error: params.error },
    { status: params.status || 401 },
  );
}

function attachSessionCookies(response: NextResponse, token: string, deviceId: string, maxAge: number) {
  response.cookies.set(SCAN_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  if (deviceId) {
    response.cookies.set(SCAN_DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = normalizeCode(body.code);
  const deviceId = normalizeDeviceId(body.device_id || request.headers.get("x-aa-device-id"));

  let jwtSecret = "";
  try {
    jwtSecret = requireEnv("JWT_SECRET");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return NextResponse.json(
      { success: false, error: "Kesalahan konfigurasi server" },
      { status: 500 },
    );
  }

  const ipHash = hashValue(getClientIp(request.headers), jwtSecret);
  const userAgentHash = hashValue(request.headers.get("user-agent") || "unknown", jwtSecret);
  const deviceHash = deviceId ? hashValue(deviceId, jwtSecret) : "";
  const deviceBound = Boolean(deviceHash);

  if (code.length !== 6) {
    return NextResponse.json(
      { success: false, error: "Kode login harus 6 digit" },
      { status: 400 },
    );
  }

  const superPin = normalizeCode(process.env.SUPER_USER_PIN);

  if (superPin && code === superPin) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SUPER_ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const maxAge = secondsUntil(expiresAt);
    const token = signToken(
      {
        role: "SUPER",
        accountId: "super",
        sessionId,
        appKey: APP_KEY,
        deviceHash: deviceHash || undefined,
        userAgentHash,
      },
      maxAge,
    );

    await writeAccessEvent({
      eventType: "SCAN_SUPER_LOGIN_SUCCESS",
      eventDetail: "super_pin_login",
      metadata: { role: "SUPER", expires_at: expiresAt, session_id: sessionId, device_bound: deviceBound },
      ipHash,
      userAgentHash,
    });

    const response = NextResponse.json({ success: true, role: "SUPER", expires_at: expiresAt, session_id: sessionId, device_bound: deviceBound });
    attachSessionCookies(response, token, deviceId, maxAge);
    return response;
  }

  try {
    const supabase = createAdminClient();
    const codeHash = hashLoginCode(code);

    const { data: loginCode, error: codeError } = await supabase
      .from("telegram_login_codes")
      .select("id, user_id, telegram_user_id, chat_id, code_type, expires_at, used_at, consumed_session_id")
      .eq("code_hash", codeHash)
      .maybeSingle<LoginCodeRow>();

    if (codeError) throw codeError;

    if (!loginCode) {
      return failLogin({ error: "Kode login tidak valid", reason: "code_not_found", ipHash, userAgentHash });
    }

    if (loginCode.used_at) {
      return failLogin({
        error: "Kode login sudah digunakan. Ambil kode baru dari bot Telegram.",
        reason: "code_already_used",
        code: loginCode,
        ipHash,
        userAgentHash,
      });
    }

    if (!isFutureDate(loginCode.expires_at)) {
      return failLogin({ error: "Kode login sudah kedaluwarsa", reason: "code_expired", code: loginCode, ipHash, userAgentHash });
    }

    const { data: user, error: userError } = await supabase
      .from("telegram_users")
      .select("id, telegram_user_id, chat_id, plan, trial_used, trial_started_at, trial_expires_at, pro_started_at, pro_expires_at, is_active, suspended_at")
      .eq("id", loginCode.user_id)
      .maybeSingle<TelegramUserRow>();

    if (userError) throw userError;

    if (!user) {
      return failLogin({ error: "Akun Telegram tidak ditemukan", reason: "telegram_user_not_found", code: loginCode, ipHash, userAgentHash });
    }

    if (!user.is_active || user.suspended_at) {
      return failLogin({ status: 403, error: "Akun Telegram sedang tidak aktif", reason: "telegram_user_inactive", code: loginCode, ipHash, userAgentHash });
    }

    const now = new Date();
    const sessionId = crypto.randomUUID();
    const trialActive = user.plan === "TRIAL" && isFutureDate(user.trial_expires_at);
    const proActive = user.plan === "PRO" && isFutureDate(user.pro_expires_at);

    let active = activeRoleAndExpiry(user);
    let loginReason = "scan_login_success";

    if (loginCode.code_type === "TRIAL_LOGIN" && !user.trial_used) {
      const trialExpiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { error: updateUserError } = await supabase
        .from("telegram_users")
        .update({
          plan: "TRIAL",
          trial_used: true,
          trial_started_at: now.toISOString(),
          trial_expires_at: trialExpiresAt,
          last_seen_at: now.toISOString(),
        })
        .eq("id", user.id);

      if (updateUserError) throw updateUserError;

      active = { role: "TRIAL", expiresAt: trialExpiresAt };
      loginReason = "scan_trial_started";
    } else if (trialActive) {
      active = { role: "TRIAL", expiresAt: user.trial_expires_at as string };
      loginReason = "scan_trial_login_success";
    } else if (proActive) {
      active = { role: "PRO", expiresAt: user.pro_expires_at as string };
      loginReason = "scan_pro_login_success";
    }

    if (!active) {
      return failLogin({
        status: 403,
        error: user.trial_used ? "Trial akun Telegram ini sudah pernah digunakan. Silakan upgrade ke PRO." : "Akses belum aktif",
        reason: user.trial_used ? "trial_already_used_or_expired" : "access_inactive",
        code: loginCode,
        ipHash,
        userAgentHash,
      });
    }

    const { data: consumedCode, error: consumeError } = await supabase
      .from("telegram_login_codes")
      .update({ used_at: now.toISOString(), consumed_session_id: sessionId })
      .eq("id", loginCode.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();

    if (consumeError) throw consumeError;

    if (!consumedCode) {
      return failLogin({
        error: "Kode login sudah digunakan. Ambil kode baru dari bot Telegram.",
        reason: "code_already_used",
        code: loginCode,
        ipHash,
        userAgentHash,
      });
    }

    const { error: sessionError } = await supabase
      .from("telegram_app_sessions")
      .upsert(
        {
          user_id: user.id,
          telegram_user_id: user.telegram_user_id,
          app_key: APP_KEY,
          session_id: sessionId,
          device_hash: deviceHash || null,
          user_agent_hash: userAgentHash,
          expires_at: active.expiresAt,
          last_seen_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id,app_key" },
      );

    if (sessionError) throw sessionError;

    await writeAccessEvent({
      userId: user.id,
      telegramUserId: user.telegram_user_id,
      chatId: user.chat_id || loginCode.chat_id,
      eventType: loginReason === "scan_trial_started" ? "SCAN_TRIAL_STARTED" : "SCAN_LOGIN_SUCCESS",
      eventDetail: loginReason,
      metadata: { code_type: loginCode.code_type, role: active.role, expires_at: active.expiresAt, session_id: sessionId, device_bound: deviceBound },
      ipHash,
      userAgentHash,
    });

    const maxAge = secondsUntil(active.expiresAt);
    const token = signToken(
      {
        role: active.role,
        accountId: user.id,
        sessionId,
        appKey: APP_KEY,
      },
      maxAge,
    );

    const response = NextResponse.json({ success: true, role: active.role, telegram_user_id: user.telegram_user_id, expires_at: active.expiresAt, session_id: sessionId, device_bound: deviceBound });
    attachSessionCookies(response, token, deviceId, maxAge);
    return response;
  } catch (e) {
    console.error("SCAN_CODE_LOGIN_ERROR", e);
    return NextResponse.json(
      { success: false, error: "Gagal login dengan kode Telegram. Pastikan tabel telegram_app_sessions sudah dibuat." },
      { status: 500 },
    );
  }
}
