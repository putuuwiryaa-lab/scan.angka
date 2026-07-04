"use client";

import { FormEvent, useMemo, useState } from "react";

const DEVICE_KEY = "aa_device_id";
const BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "";

function createDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDeviceId() {
  try {
    const current = window.localStorage.getItem(DEVICE_KEY);
    if (current) return current;
    const next = createDeviceId();
    window.localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return createDeviceId();
  }
}

function isValidBotUrl(value: string) {
  return /^https:\/\/t\.me\/[a-zA-Z0-9_]+(?:\?.*)?$/.test(value);
}

export default function KodeLoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    return next.startsWith("/") ? next : "/";
  }, []);
  const botUrl = isValidBotUrl(BOT_URL) ? BOT_URL : "";

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const cleaned = code.replace(/\D/g, "").slice(0, 6);
    setError("");

    if (cleaned.length !== 6) {
      setError("Kode login harus 6 digit.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/code-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleaned, device_id: getDeviceId() }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok || data.error) {
        setError(data.error || "Kode login tidak valid.");
        return;
      }

      window.location.replace(nextPath);
    } catch {
      setError("Gagal login. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="access-page">
      <section className="access-card">
        <span className="access-kicker">Scan Angka</span>
        <h1>Login Telegram</h1>
        <p>Ambil kode login dari bot Telegram Analisa Angka, lalu masukkan 6 digit kode di sini.</p>

        {botUrl ? (
          <a className="access-submit" href={botUrl} target="_blank" rel="noreferrer">
            Buka Bot Telegram
          </a>
        ) : (
          <div className="access-error">
            Link bot belum diatur. Isi NEXT_PUBLIC_TELEGRAM_BOT_URL di Vercel.
          </div>
        )}

        <form className="access-form" onSubmit={submitCode}>
          <label htmlFor="telegram-code">Kode Login</label>
          <input
            id="telegram-code"
            inputMode="numeric"
            pattern="\d{6}"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          {error ? <div className="access-error">{error}</div> : null}
          <button type="submit" disabled={loading}>{loading ? "Memeriksa..." : "Masuk"}</button>
        </form>
      </section>
    </main>
  );
}
