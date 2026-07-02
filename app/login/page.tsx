"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError("");
    const cleanedPin = pin.replace(/\D/g, "").slice(0, 8);
    if (cleanedPin.length !== 8) {
      setError("Kode akses harus 8 digit.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: cleanedPin }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error || "Kode akses tidak valid.");
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.replace(next.startsWith("/") ? next : "/");
    } catch {
      setError("Gagal memeriksa akses.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="access-page">
      <section className="access-card">
        <span className="access-kicker">Scan Angka</span>
        <h1>Akses Terbatas</h1>
        <p>Aplikasi masih dalam tahap pengembangan. Akses hanya tersedia untuk pengguna tertentu.</p>

        <form className="access-form" onSubmit={submitAccess}>
          <label htmlFor="access-pin">Kode Akses</label>
          <input
            id="access-pin"
            inputMode="numeric"
            pattern="\d{8}"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="8 digit"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
          />
          {error ? <div className="access-error">{error}</div> : null}
          <button type="submit" disabled={loading}>{loading ? "Memeriksa..." : "Lanjut"}</button>
        </form>
      </section>
    </main>
  );
}
