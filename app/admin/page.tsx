"use client";

import { FormEvent, useEffect, useState } from "react";

type PinRow = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
  used_at: string | null;
  revoked_at: string | null;
  device_name: string | null;
  last_seen_at: string | null;
  session_revoked_at: string | null;
};

type SessionRow = {
  id: string;
  device_name: string | null;
  device_id: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  status: string;
  pin_note: string | null;
};

function dateText(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

export default function AdminPage() {
  const [note, setNote] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pins, setPins] = useState<PinRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAll() {
    setError("");
    try {
      const [pinRes, sessionRes] = await Promise.all([
        fetch("/api/admin/pins"),
        fetch("/api/admin/sessions"),
      ]);

      if (pinRes.status === 401 || sessionRes.status === 401) {
        window.location.replace("/admin/login");
        return;
      }

      const pinData = await pinRes.json().catch(() => ({}));
      const sessionData = await sessionRes.json().catch(() => ({}));

      if (!pinRes.ok) throw new Error(pinData.error || "Gagal memuat PIN.");
      if (!sessionRes.ok) throw new Error(sessionData.error || "Gagal memuat session.");

      setPins(pinData.pins || []);
      setSessions(sessionData.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat admin.");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setNewPin("");
    setError("");

    try {
      const response = await fetch("/api/admin/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "Gagal membuat PIN.");

      setNewPin(data.pin);
      setNote("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat PIN.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Hapus akses session ini?")) return;

    try {
      const response = await fetch(`/api/admin/sessions/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Dihapus admin" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal hapus akses.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal hapus akses.");
    }
  }

  async function revokePin(id: string) {
    if (!confirm("Batalkan PIN ini?")) return;

    try {
      const response = await fetch(`/api/admin/pins/${id}/revoke`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal membatalkan PIN.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan PIN.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.replace("/admin/login");
  }

  return (
    <main className="wrap admin-wrap">
      <header className="hero">
        <div className="hero-kicker">Admin Akses</div>
        <h1>Kelola PIN</h1>
        <p>Generate PIN 1x pakai dan hapus akses session aktif.</p>
      </header>

      {error ? <div className="access-error">{error}</div> : null}

      <section className="card panel admin-panel">
        <h2>Generate PIN Baru</h2>
        <form className="access-form" onSubmit={generate}>
          <label htmlFor="note">Catatan</label>
          <input
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Contoh: trial user A"
            style={{ letterSpacing: 0, fontSize: 16 }}
          />
          <button type="submit" disabled={loading}>{loading ? "Membuat..." : "Generate PIN"}</button>
        </form>
        {newPin ? <div className="admin-pin-result">PIN baru: <strong>{newPin}</strong></div> : null}
      </section>

      <section className="card panel admin-panel">
        <h2>Session Aktif</h2>
        <div className="admin-list">
          {sessions.map((session) => (
            <div className="admin-row" key={session.id}>
              <div>
                <strong>{session.device_name || "Unknown Device"}</strong>
                <span>Status: {session.status}</span>
                <span>Catatan: {session.pin_note || "-"}</span>
                <span>Dibuat: {dateText(session.created_at)}</span>
                <span>Last seen: {dateText(session.last_seen_at)}</span>
              </div>
              {session.revoked_at ? (
                <em>Sudah dihapus</em>
              ) : (
                <button type="button" onClick={() => revoke(session.id)}>Hapus Akses</button>
              )}
            </div>
          ))}
          {!sessions.length ? <p>Belum ada session.</p> : null}
        </div>
      </section>

      <section className="card panel admin-panel">
        <h2>Riwayat PIN</h2>
        <div className="admin-list">
          {pins.map((pin) => (
            <div className="admin-row" key={pin.id}>
              <div>
                <strong>{pin.status}</strong>
                <span>Catatan: {pin.note || "-"}</span>
                <span>Dibuat: {dateText(pin.created_at)}</span>
                <span>Dipakai: {dateText(pin.used_at)}</span>
                <span>Device: {pin.device_name || "-"}</span>
              </div>
              {pin.status === "unused" ? (
                <button type="button" onClick={() => revokePin(pin.id)}>Batalkan PIN</button>
              ) : null}
            </div>
          ))}
          {!pins.length ? <p>Belum ada PIN.</p> : null}
        </div>
      </section>

      <button className="access-submit" type="button" onClick={logout}>Logout Admin</button>
    </main>
  );
}
