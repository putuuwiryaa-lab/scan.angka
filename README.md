# Scan Angka

Scan Angka adalah aplikasi web untuk membaca riwayat data angka, menjalankan proses scan berdasarkan Data Uji, lalu menampilkan output per pasaran maupun banyak pasaran sekaligus melalui fitur Batch Scan.

Dibuat dengan **Next.js**, **TypeScript**, **Supabase**, **Vercel**, dan dukungan **PWA** agar ringan dipakai dari HP dan bisa dipasang ke layar utama.

## Stack

| Bagian | Teknologi |
| --- | --- |
| Frontend | Next.js + TypeScript |
| Database | Supabase |
| Deploy | Vercel |
| App-like install | PWA |

## Fitur Utama

- Scan satu pasaran.
- Batch Scan banyak pasaran sekaligus.
- Trek tersimpan lintas pasaran.
- Mode scan posisi, 2D, shio, dan OFF.
- Output ringkas dan siap copy.
- Detail hasil scan per rumus.

## Quick Start

```bash
git clone https://github.com/putuuwiryaa-lab/scan.angka.git
cd scan.angka
npm install
npm run dev
```

Buka:

```txt
http://localhost:3000
```

## Dokumentasi

| File | Isi |
| --- | --- |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Fitur, struktur halaman/API, dan cara pakai |
| [`docs/ENGINE.md`](docs/ENGINE.md) | Cara kerja engine dan logic ranking |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Skema Supabase, query SQL, dan RLS policy |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Env vars, instalasi lokal, build, deploy Vercel, dan PWA |
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md) | Struktur folder dan file utama |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Masalah umum dan cara cek |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Status pengembangan, rencana, dan lisensi |

## Catatan

Scan Angka adalah alat bantu analisa berbasis riwayat data dan parameter yang dipilih pengguna.
