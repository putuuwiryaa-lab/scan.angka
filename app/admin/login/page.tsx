"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setError(data.error || "Login admin gagal.");
        return;
      }

      window.location.replace("/admin");
    } catch {
      setError("Login admin gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="access-page">
      <section className="access-card">
        <span className="access-kicker">Admin</span>
        <h1>Login Admin</h1>
        <p>Masukkan password admin untuk generate PIN dan menghapus akses user.</p>

        <form className="access-form" onSubmit={submit}>
          <label htmlFor="password">Password Admin</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{ letterSpacing: 1, fontSize: 18 }}
          />
          {error ? <div className="access-error">{error}</div> : null}
          <button type="submit" disabled={loading}>{loading ? "Memeriksa..." : "Masuk Admin"}</button>
        </form>
      </section>
    </main>
  );
}
