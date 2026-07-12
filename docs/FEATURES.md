# Fitur Scan Angka

Dokumen ini merangkum fitur aplikasi, struktur halaman/API, dan cara pakai dasar.

## Ringkasan Fitur

- Scan satu pasaran.
- Batch Scan banyak pasaran sekaligus.
- Batch Adaptif untuk menjalankan turnamen L14 pada beberapa pasaran.
- Trek tersimpan lintas pasaran.
- Mode scan Posisi, AI, BBFS, Jumlah, Shio, dan OFF.
- Adaptive Movement Engine untuk analisa pergerakan data.
- Pilihan output Adaptif: Posisi, AI, dan BBFS.
- Pilihan target posisi, 2D, 3D, atau 4D.
- Pilihan jumlah digit.
- Walk-forward tetap pada 14 result terbaru.
- Window training kelipatan 14.
- Turnamen seluruh metode × window.
- Sepuluh model umum dan dua model pasangan 00–99.
- Release gate terhadap baseline.
- Ranking probabilitas digit untuk rekomendasi yang lolos.
- Output ringkas dan siap copy.
- PWA installable.
- Data pasaran dibaca dari Supabase melalui server.

## Adaptive Movement Engine

Model umum yang diuji:

- Delta Movement;
- Pattern Motif;
- Cycle Analysis;
- Cross Position;
- Markov Order-1;
- Markov Order-2;
- Momentum Decay;
- Transition Matrix;
- Regime Adaptive;
- Consensus Ensemble.

Model tambahan khusus target 2D:

- Joint Pair;
- Pair Markov 00–99.

Empat belas result terbaru selalu dijadikan data uji walk-forward. Data sebelum target menjadi training dan diambil menggunakan window kelipatan 14.

Dengan 168 result, window yang diuji:

```txt
W14, W28, W42, W56, W70, W84,
W98, W112, W126, W140, W154
```

Jumlah konfigurasi:

```txt
Posisi / 3D / 4D = 110 kandidat
Target 2D        = 132 kandidat
```

Setiap metode diuji pada seluruh window tersebut. Pemenang dipilih berdasarkan L14, L7, miss streak, L3, dan stabilitas window tetangga. Metode pemenang kemudian dilatih ulang memakai window terbaru untuk membentuk prediksi berikutnya.

Rekomendasi tidak diterbitkan jika kemenangan pemenang belum melewati batas baseline.

### Posisi

User memilih AS, COP, KPL, atau EKR. Status kena jika digit posisi berikutnya terdapat di output.

### AI

User memilih target 2D, 3D, atau 4D. Status kena jika **minimal satu digit target** terdapat di output AI.

### BBFS

User memilih target 2D, 3D, atau 4D. Status kena hanya jika **seluruh digit target** terdapat di output BBFS.

Untuk target 2D, Joint Pair dan Pair Markov menilai pasangan 00–99 secara langsung.

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
| `/api/movement` | POST | Menjalankan turnamen adaptif L14 dan membentuk output |
| `/api/batch-scan` | POST | Menjalankan Scan Rumus atau Adaptif untuk beberapa pasaran |
| `/api/saved-trek` | POST | Refresh trek tersimpan |

## Cara Pakai Adaptif

1. Buka menu **Adaptif**.
2. Pilih pasaran.
3. Pilih jenis output: Posisi, AI, atau BBFS.
4. Pilih target.
5. Pilih jumlah digit.
6. Tekan **Jalankan Analisis Adaptif**.
7. Lihat model terpilih dan riwayat validasi L14.
8. Jika lolos baseline, salin rekomendasi yang diterbitkan.

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

Batas proses:

```txt
Scan Rumus = maksimal 35 pasaran
Ada Adaptif = maksimal 5 pasaran
```

Batas Adaptif lebih rendah karena setiap pasaran menjalankan seluruh turnamen metode × window pada walk-forward L14. Pasaran yang tidak melewati release gate ditampilkan sebagai `BELUM LAYAK`, sedangkan riwayat di bawah 28 result ditampilkan sebagai `DATA BELUM CUKUP`.
