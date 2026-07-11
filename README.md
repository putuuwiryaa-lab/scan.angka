# Scan Angka

Scan Angka adalah aplikasi web untuk membaca riwayat data angka, menjalankan proses scan berdasarkan Data Uji, lalu menampilkan output per pasaran maupun banyak pasaran sekaligus melalui fitur Batch Scan.

Aplikasi memiliki dua jalur analisa yang terpisah: **Scan Engine** untuk evaluasi rumus/kolom dan **Echo Engine** untuk mencari kemiripan pola historis serta menghasilkan satu rekomendasi terbaik.

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
- Echo Engine berbasis kemiripan pola historis.
- Trek tersimpan lintas pasaran.
- Mode scan posisi, 2D, 3D, shio, dan OFF.
- Output ringkas dan siap copy.
- Detail hasil scan dan riwayat evaluasi.

## Echo Engine

Echo Engine membaca bentuk pergerakan terbaru, mencari kondisi historis yang paling mirip, lalu memproyeksikan angka acuan untuk membentuk rekomendasi sesuai jumlah digit yang dipilih.

Echo tetap merupakan **satu engine**. Kode profil di bawah adalah variasi pembacaan pola di dalam Echo, bukan mesin prediksi yang saling melakukan voting bebas.

| Profil | Fokus pembacaan |
| --- | --- |
| `EL` | Pergerakan lokal pada posisi acuan |
| `EX` | Hubungan pergerakan antarposisi |
| `ER` | Kesesuaian kondisi atau regime pola |
| `EA` | Pergerakan area target 2D/3D |
| `EJ` | Pola jumlah 2D |
| `ES` | Pola indeks shio |

### Cara kerja

1. Membentuk state dari lima hasil terakhir pada setiap titik historis.
2. Mengukur kemiripan berdasarkan arah gerak, percepatan, volatilitas, pengulangan, rentang, dan kondisi pola.
3. Mengambil tetangga historis terdekat secara adaptif dan memberi bobot berdasarkan kemiripan serta recency.
4. Menguji beberapa konfigurasi tetangga dan bobot waktu untuk mengukur konsistensi prediksi.
5. Memilih kolom rekomendasi melalui evaluasi awal dan nested walk-forward.
6. Membekukan metode terbaik, lalu mengujinya satu kali pada verifikasi akhir.
7. Menampilkan satu rekomendasi bila seluruh standar terpenuhi; jika tidak, rekomendasi tidak dipaksakan.

### Pembagian evaluasi

Echo membutuhkan minimal **80 hasil**. Jumlah baris evaluasi menyesuaikan banyaknya data yang tersedia.

| Data tersedia | Evaluasi awal | Uji berurutan | Verifikasi akhir | Total evaluasi |
| --- | ---: | ---: | ---: | ---: |
| 220+ | 48 | 16 | 16 | 80 |
| 150–219 | 36 | 12 | 12 | 60 |
| 120–149 | 30 | 10 | 10 | 50 |
| 95–119 | 24 | 8 | 8 | 40 |
| 80–94 | 18 | 6 | 6 | 30 |

### Prinsip validasi

- Evaluasi dilakukan mengikuti urutan waktu; setiap target hanya menggunakan data sebelumnya.
- Profil dipilih dari evaluasi awal dan nested walk-forward.
- Verifikasi akhir tidak digunakan untuk memilih profil atau berpindah ke kandidat lain.
- Verifikasi akhir berfungsi sebagai gerbang satu arah: rekomendasi diterima atau ditolak.
- Skor akhir mempertimbangkan performa relatif terhadap baseline, konsistensi antarperiode, keyakinan kondisi terkini, jumlah tetangga efektif, serta gagal beruntun.
- Kategori `KUAT`, `CUKUP`, dan `PANTAU` tidak hanya ditentukan oleh satu persentase.

### Pemisahan dari Scan Engine

Echo Engine berada di modul `lib/echo/` dan tidak mengubah cara kerja Scan Engine reguler. Perubahan atau eksperimen pada Echo harus tetap dijaga agar tidak memengaruhi hasil menu Scan dan Batch.

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

Scan Angka adalah alat bantu analisa berbasis riwayat data dan parameter yang dipilih pengguna. Performa historis tidak menjamin hasil berikutnya.
