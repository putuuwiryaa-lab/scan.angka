"use client";

import { FormEvent, useState } from "react";

const DEVICE_KEY = "scan_device_id";
const ADMIN_WHATSAPP_URL = "https://wa.me/6285119341538";

function getDeviceId() {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const next = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(DEVICE_KEY, next);
  return next;
}

function deviceName() {
  if (typeof navigator === "undefined") return "Unknown Device";
  return navigator.userAgent.slice(0, 150);
}

export default function PinPage() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const clean = pin.replace(/\D/g, "").slice(0, 8);
    if (clean.length !== 8) {
      setError("Kode akses harus 8 digit.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/pin/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: clean, device_id: getDeviceId(), device_name: deviceName() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setError(data.error || "Kode akses tidak bisa digunakan.");
        return;
      }

      window.location.replace("/");
    } catch {
      setError("Gagal memeriksa kode akses.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="access-page">
      <section className="access-card">
        <span className="access-kicker">Akses Aplikasi</span>
        <h1>Masuk Aplikasi</h1>
        <p>Masukkan kode akses untuk membuka Scan Angka.</p>

        <form className="access-form" onSubmit={submit}>
          <label htmlFor="pin">Kode Akses</label>
          <input
            id="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="0000-0000"
            value={pin}
            maxLength={9}
            onChange={(event) => {
              const clean = event.target.value.replace(/\D/g, "").slice(0, 8);
              const formatted = clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
              setPin(formatted);
            }}
          />
          {error ? <div className="access-error">{error}</div> : null}
          <button className="access-primary-button" type="submit" disabled={loading}>{loading ? "Memeriksa Kode..." : "Lanjutkan ke Aplikasi"}</button>
        </form>

        <a className="access-contact-box" href={ADMIN_WHATSAPP_URL} target="_blank" rel="noreferrer">
          <span>Belum punya kode akses?</span>
          <strong>Hubungi Admin</strong>
        </a>
      </section>
    </main>
  );
}
