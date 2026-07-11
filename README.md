# Scan Angka

Scan Angka adalah aplikasi web untuk membaca riwayat data angka, menjalankan scan rumus, dan menganalisa pergerakan data untuk membentuk output Posisi, AI, atau BBFS.

Dibuat dengan **Next.js**, **TypeScript**, **Supabase**, **Vercel**, dan dukungan **PWA** agar ringan dipakai dari HP dan dapat dipasang ke layar utama.

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
- Mode scan posisi, 2D, 3D, shio, dan OFF.
- **Movement Engine** untuk membaca transisi, motif gerakan, siklus, serta hubungan antarposisi.
- Output Movement: Posisi, AI, dan BBFS.
- Walk-forward validation dan final holdout.
- Output ringkas dan siap copy.
- Detail evaluasi per periode.

## Aturan Output Movement

- **Posisi:** digit posisi berikutnya harus masuk ke output.
- **AI:** minimal satu digit target berikutnya harus masuk.
- **BBFS:** seluruh digit target berikutnya harus masuk.

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

## Pemeriksaan

```bash
npm run typecheck
npm run test:movement
npm run build
```

## Dokumentasi

| File | Isi |
| --- | --- |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Fitur, halaman, API, dan cara pakai |
| [`docs/ENGINE.md`](docs/ENGINE.md) | Engine scan dan Movement Engine |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Skema Supabase, query SQL, dan RLS policy |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Env vars, instalasi, build, deploy, dan PWA |
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md) | Struktur folder dan file utama |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Masalah umum dan cara cek |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Status pengembangan, rencana, dan lisensi |

## Catatan

Scan Angka adalah alat bantu analisa berbasis riwayat data. Evaluasi historis tidak menjamin hasil berikutnya.
