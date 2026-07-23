# Fitur Scan Angka

Dokumen ini merangkum fitur aplikasi, struktur halaman/API, dan cara pakai dasar.

## Ringkasan Fitur

- Scan satu pasaran.
- Batch Scan banyak pasaran sekaligus.
- Batch Adaptif hingga 35 pasaran dengan pemrosesan bertahap.
- Trek tersimpan lintas pasaran.
- Mode scan Posisi, AI, BBFS, Jumlah, Shio, dan OFF.
- Adaptive Movement Engine untuk analisa pergerakan data.
- Prediction Ledger untuk mengukur performa live hasil Adaptif.
- Pilihan output Adaptif: Posisi, AI, dan BBFS.
- Pilihan target posisi, 2D, 3D, atau 4D.
- Pilihan jumlah digit.
- Walk-forward tetap pada 14 result terbaru.
- Window training kelipatan 14.
- Turnamen seluruh metode × window.
- Sembilan model umum dan satu model pasangan 00–99.
- Tidak menggunakan metode Markov.
- Semua hasil adaptif diterbitkan selama data minimum tersedia.
- Ranking probabilitas digit untuk rekomendasi berikutnya.
- Output ringkas dan siap copy.
- PWA installable.
- Data pasaran dibaca dari Supabase melalui server.

## Adaptive Movement Engine

Model umum yang diuji:

- Delta Movement;
- Pattern Motif;
- Cycle Analysis;
- Cross Position;
- Momentum Decay;
- Transition Matrix;
- Regime Adaptive;
- Consensus Ensemble;
- Walk-Forward Weighted Ensemble.

Model tambahan khusus target 2D:

- Joint Pair.

Empat belas result terbaru selalu dijadikan data uji walk-forward. Data sebelum target menjadi training dan diambil menggunakan window kelipatan 14.

Dengan 168 result, window yang diuji:

```txt
W14, W28, W42, W56, W70, W84,
W98, W112, W126, W140, W154
```

Jumlah konfigurasi:

```txt
Posisi / 3D / 4D = 99 kandidat
Target 2D        = 110 kandidat
```

Setiap metode diuji pada seluruh window tersebut. Pemenang dipilih berdasarkan L14, L7, miss streak, L3, dan stabilitas window tetangga. Metode pemenang kemudian dilatih ulang memakai window terbaru untuk membentuk prediksi berikutnya.

Konfigurasi dengan ranking tertinggi selalu diterbitkan selama data minimum tersedia. Nilai validasi, confidence, kualitas sinyal, dan audit tetap ditampilkan sebagai informasi evaluasi.

### Posisi

User memilih AS, COP, KPL, atau EKR. Status kena jika digit posisi berikutnya terdapat di output.

### AI

User memilih target 2D, 3D, atau 4D. Status kena jika **minimal satu digit target** terdapat di output AI.

### BBFS

User memilih target 2D, 3D, atau 4D. Status kena hanya jika **seluruh digit target** terdapat di output BBFS.

Untuk target 2D, Joint Pair menilai pasangan 00–99 secara langsung.

## Prediction Ledger

Hasil Adaptif dari halaman `/movement` dan Batch Adaptif dicatat sebagai prediksi live `pending`. Request berulang dengan pasaran, histori, konfigurasi, metode, dan window yang sama tidak membuat duplikasi.

Ketika pasaran diproses lagi setelah result baru tersedia, prediksi dinilai terhadap result pertama setelah histori sumber. Status akhirnya:

- `settled` untuk prediksi yang berhasil dinilai sebagai hit atau miss;
- `invalidated` bila histori sumber berubah dan tidak lagi cocok;
- `pending` selama result berikutnya belum tersedia.

Rekap live tersedia dari endpoint `/api/adaptive-ledger`, termasuk hit rate, miss streak, performa per pasaran, serta performa per metode × window. Ledger belum memengaruhi pemilihan model pada tahap observasi pertama.

## Struktur Halaman

| Route | Fungsi |
| --- | --- |
| `/` | Scan utama untuk satu pasaran |
| `/movement` | Adaptif: Posisi, AI, dan BBFS |
| `/batch` | Batch Scan Rumus dan Batch Adaptif |
| `/admin` | Pengelolaan PIN dan akses device |
| `/manifest.webmanifest` | Manifest PWA |
| `/sw.js` | Service worker PWA |

## Struktur API

| API | Method | Fungsi |
| --- | --- | --- |
| `/api/markets` | GET | Mengambil daftar pasaran |
| `/api/scan` | POST | Scan satu pasaran |
| `/api/movement` | POST | Menjalankan turnamen adaptif L14, mencatat ledger, dan membentuk output |
| `/api/batch-scan` | POST | Menjalankan satu bagian Batch Scan atau Adaptif dan mencatat hasil Adaptif |
| `/api/adaptive-ledger` | GET | Rekap performa live prediksi Adaptif |
| `/api/saved-trek` | POST | Refresh trek tersimpan |

## Cara Pakai Adaptif

1. Buka menu **Adaptif**.
2. Pilih pasaran.
3. Pilih jenis output: Posisi, AI, atau BBFS.
4. Pilih target.
5. Pilih jumlah digit.
6. Tekan **Jalankan Analisis Adaptif**.
7. Lihat model terpilih dan riwayat validasi L14.
8. Salin hasil adaptif yang diterbitkan.

## Batch Scan & Adaptif

Setiap kartu metode di halaman Batch dapat memakai Scan Rumus atau Adaptif. Pilihan Adaptif yang tersedia:

- Adaptif Posisi;
- Adaptif AI 2D;
- Adaptif BBFS 2D;
- Adaptif AI 3D;
- Adaptif BBFS 3D;
- Adaptif AI 4D;
- Adaptif BBFS 4D.

Metode 1 dan Metode 2 dapat digabung, termasuk kombinasi Scan Rumus + Adaptif. Output setiap pasaran tetap menggunakan format satu baris dan siap disalin.

Batas pilihan:

```txt
Scan Rumus = maksimal 35 pasaran
Ada Adaptif = maksimal 35 pasaran
```

Untuk menjaga kestabilan server, Batch Adaptif tidak mengirim seluruh pasaran dalam satu request. Browser membagi pilihan menjadi kelompok berisi maksimal 5 pasaran, memproses kelompok tersebut secara berurutan, lalu menggabungkan seluruh hasil menjadi satu output.

Contoh 35 pasaran:

```txt
35 pasaran ÷ 5 pasaran per tahap = 7 tahap
```

Progress tahap ditampilkan pada tombol proses. Semua hasil dengan riwayat yang cukup diterbitkan; riwayat di bawah 28 result ditampilkan sebagai `DATA BELUM CUKUP`.
