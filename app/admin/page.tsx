"use client";

import { FormEvent, useEffect, useState } from "react";

const BENCHMARK_MODES = [
  ["ai_2d_belakang", "AI 2D"],
  ["bbfs_2d_belakang", "BBFS 2D"],
  ["jumlah_2d_belakang", "Jumlah 2D"],
  ["ai_3d", "AI 3D"],
  ["bbfs_3d", "BBFS 3D"],
  ["posisi", "Posisi"],
  ["off_posisi", "OFF Posisi"],
  ["off_2d_belakang", "OFF 2D"],
  ["off_jumlah_2d_belakang", "OFF Jumlah 2D"],
  ["off_3d", "OFF 3D"],
  ["shio", "Shio"],
  ["off_shio", "OFF Shio"],
] as const;

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

type BenchmarkMarket = {
  marketId: string;
  marketName: string;
  dataSize: number;
  status: string;
  message: string;
  selectionKind: string | null;
  family: string | null;
  formula: string | null;
  strength: string | null;
  score: number | null;
  discoveryLift: number | null;
  validationLift: number | null;
  holdoutLift: number | null;
  combinedLift: number | null;
  softAccepted: boolean;
  diagnostics: Array<{ code: string; label: string; detail: string }>;
};

type BenchmarkResponse = {
  pagination: {
    total: number;
    returned: number;
    nextOffset: number | null;
  };
  aggregate: {
    batchSize: number;
    evaluated: number;
    released: number;
    releaseRate: number;
    statusCounts: Record<string, number>;
    rejectionCounts: Record<string, number>;
    selectionCounts: Record<string, number>;
    familyCounts: Record<string, number>;
    familyEligibilityCounts: Record<string, number>;
    softAccepted: number;
    averageScore: number | null;
    averageDiscoveryLift: number | null;
    averageValidationLift: number | null;
    averageHoldoutLift: number | null;
    averageCombinedLift: number | null;
  };
  results: BenchmarkMarket[];
};

function dateText(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

function metric(value: number | null, suffix = "") {
  return value === null ? "-" : `${value}${suffix}`;
}

function countText(values: Record<string, number>) {
  const entries = Object.entries(values).sort((left, right) => right[1] - left[1]);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(" · ") : "-";
}

export default function AdminPage() {
  const [note, setNote] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pins, setPins] = useState<PinRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [pinLoading, setPinLoading] = useState(false);
  const [error, setError] = useState("");
  const [benchmarkMode, setBenchmarkMode] = useState("ai_2d_belakang");
  const [benchmarkDigits, setBenchmarkDigits] = useState(4);
  const [benchmarkOffset, setBenchmarkOffset] = useState(0);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);

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
    if (pinLoading) return;

    setPinLoading(true);
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
      setPinLoading(false);
    }
  }

  async function runBenchmark(offset = 0) {
    if (benchmarkLoading) return;
    setBenchmarkLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/echo-benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanMode: benchmarkMode,
          digitCount: benchmarkDigits,
          targetPos: "K",
          target2D: "belakang",
          target3D: "belakang",
          limit: 10,
          offset,
        }),
      });
      if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Benchmark Echo gagal.");
      setBenchmark(data);
      setBenchmarkOffset(offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Benchmark Echo gagal.");
    } finally {
      setBenchmarkLoading(false);
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
        <h1>Kelola Akses</h1>
        <p>Buat kode akses, kelola device, dan audit Echo v2 pada beberapa pasaran.</p>
      </header>

      {error ? <div className="access-error">{error}</div> : null}

      <section className="card panel admin-panel">
        <h2>Benchmark Echo v2</h2>
        <p>Memproses maksimal 10 pasaran per batch. Riwayat keluaran tidak dikirim ke browser.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
          <label>
            Mode
            <select value={benchmarkMode} onChange={(event) => setBenchmarkMode(event.target.value)} style={{ width: "100%", minHeight: 44 }}>
              {BENCHMARK_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Jumlah digit
            <input
              type="number"
              min={1}
              max={benchmarkMode.includes("shio") ? 12 : 9}
              value={benchmarkDigits}
              onChange={(event) => setBenchmarkDigits(Math.max(1, Number(event.target.value) || 1))}
              style={{ width: "100%", minHeight: 44 }}
            />
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="admin-button admin-button-primary" type="button" disabled={benchmarkLoading} onClick={() => runBenchmark(0)}>
            {benchmarkLoading ? "Memproses..." : "Mulai dari Batch Pertama"}
          </button>
          <button className="admin-button" type="button" disabled={benchmarkLoading || benchmarkOffset <= 0} onClick={() => runBenchmark(Math.max(0, benchmarkOffset - 10))}>
            Batch Sebelumnya
          </button>
          <button className="admin-button" type="button" disabled={benchmarkLoading || benchmark?.pagination.nextOffset === null || !benchmark} onClick={() => runBenchmark(benchmark?.pagination.nextOffset ?? 0)}>
            Batch Berikutnya
          </button>
        </div>

        {benchmark ? (
          <div className="admin-list" style={{ marginTop: 14 }}>
            <div className="admin-row">
              <div>
                <strong>Ringkasan batch {benchmarkOffset + 1}–{benchmarkOffset + benchmark.pagination.returned}</strong>
                <span>Dirilis: {benchmark.aggregate.released}/{benchmark.aggregate.evaluated} ({benchmark.aggregate.releaseRate}%)</span>
                <span>Rata-rata score: {metric(benchmark.aggregate.averageScore)}</span>
                <span>Lift discovery: {metric(benchmark.aggregate.averageDiscoveryLift, "%")}</span>
                <span>Lift validation: {metric(benchmark.aggregate.averageValidationLift, "%")}</span>
                <span>Lift holdout rilis: {metric(benchmark.aggregate.averageHoldoutLift, "%")}</span>
                <span>Status: {countText(benchmark.aggregate.statusCounts)}</span>
                <span>Alasan gugur: {countText(benchmark.aggregate.rejectionCounts)}</span>
                <span>Model rilis: {countText(benchmark.aggregate.selectionCounts)}</span>
                <span>Keluarga rilis: {countText(benchmark.aggregate.familyCounts)}</span>
              </div>
            </div>
            {benchmark.results.map((result) => (
              <div className="admin-row" key={result.marketId}>
                <div>
                  <strong>{result.marketName} · {result.status}</strong>
                  <span>Data: {result.dataSize} · model: {result.selectionKind || "-"} · metode: {result.formula || "-"}</span>
                  <span>Score: {metric(result.score)} · discovery: {metric(result.discoveryLift, "%")} · validation: {metric(result.validationLift, "%")} · holdout: {metric(result.holdoutLift, "%")}</span>
                  <span>{result.message}</span>
                  {result.diagnostics.length ? <span>Diagnostik: {result.diagnostics.map((item) => item.code).join(", ")}</span> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="card panel admin-panel">
        <h2>Buat Kode Akses Baru</h2>
        <form className="access-form" onSubmit={generate}>
          <label htmlFor="note">Catatan</label>
          <input
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Contoh: trial user A"
            style={{ letterSpacing: 0, fontSize: 16 }}
          />
          <button className="admin-button admin-button-primary" type="submit" disabled={pinLoading}>{pinLoading ? "Membuat Kode..." : "Buat Kode Akses"}</button>
        </form>
        {newPin ? <div className="admin-pin-result">Kode baru: <strong>{newPin}</strong></div> : null}
      </section>

      <section className="card panel admin-panel">
        <h2>Akses Device Aktif</h2>
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
                <em>Akses sudah dihapus</em>
              ) : (
                <button className="admin-button admin-button-danger" type="button" onClick={() => revoke(session.id)}>Hapus Akses Device</button>
              )}
            </div>
          ))}
          {!sessions.length ? <p>Belum ada session.</p> : null}
        </div>
      </section>

      <section className="card panel admin-panel">
        <h2>Riwayat Kode Akses</h2>
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
                <button className="admin-button admin-button-warning" type="button" onClick={() => revokePin(pin.id)}>Batalkan Kode Ini</button>
              ) : null}
            </div>
          ))}
          {!pins.length ? <p>Belum ada kode akses.</p> : null}
        </div>
      </section>

      <button className="access-submit admin-logout-button" type="button" onClick={logout}>Keluar dari Admin</button>
    </main>
  );
}
