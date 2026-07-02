export const ACCESS_COOKIE = "scan_angka_access";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function getSecret() {
  return process.env.APP_AUTH_SECRET || process.env.APP_ACCESS_PIN || "";
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(digest);
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export function normalizePin(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 8);
}

export function hasAccessPin() {
  return /^\d{8}$/.test(process.env.APP_ACCESS_PIN ?? "");
}

export function isCorrectPin(value: unknown) {
  const pin = process.env.APP_ACCESS_PIN ?? "";
  return /^\d{8}$/.test(pin) && normalizePin(value) === pin;
}

export async function createAccessToken(now = Date.now()) {
  const secret = getSecret();
  if (!secret) return "";
  const issuedAt = Math.floor(now / 1000).toString();
  const signature = await sha256(`${issuedAt}.${secret}`);
  return `${issuedAt}.${signature}`;
}

export async function verifyAccessToken(token: string | undefined) {
  const secret = getSecret();
  if (!secret || !token) return false;

  const [issuedAt, signature] = token.split(".");
  const issuedAtNumber = Number(issuedAt);
  if (!issuedAt || !signature || !Number.isFinite(issuedAtNumber)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (issuedAtNumber > now + 60) return false;
  if (now - issuedAtNumber > SESSION_TTL_SECONDS) return false;

  const expected = await sha256(`${issuedAt}.${secret}`);
  return safeEqual(signature, expected);
}
