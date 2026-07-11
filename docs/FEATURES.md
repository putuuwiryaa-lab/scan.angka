# Fitur Scan Angka

Dokumen ini merangkum fitur aplikasi, struktur halaman/API, dan cara pakai dasar.

## Ringkasan Fitur

- Scan satu pasaran.
- Batch Scan banyak pasaran sekaligus.
- Trek tersimpan lintas pasaran.
- Mode scan Posisi, AI, BBFS, Jumlah, Shio, dan OFF.
- Movement Engine untuk analisa pergerakan data.
- Pilihan output Movement: Posisi, AI, dan BBFS.
- Pilihan target posisi, 2D, 3D, atau 4D.
- Pilihan jumlah digit.
- Evaluasi walk-forward, final holdout, L15, L30, dan L60.
- Ranking probabilitas digit.
- Output ringkas dan siap copy.
- PWA installable.
- Data pasaran dibaca dari Supabase melalui server.

## Movement Engine

Movement Engine membaca:

- transisi digit dan delta;
- motif gerakan terbaru;
- jarak siklus kemunculan;
- hubungan pergerakan AS, COP, KPL, dan EKR.

Bobot model tidak dipilih oleh user. Beberapa profil bobot diuji secara walk-forward dan profil terbaik dipakai pada final holdout serta prediksi live.

### Posisi

User memilih AS, COP, KPL, atau EKR. Status kena jika digit posisi berikutnya terdapat di output.

### AI

User memilih target 2D, 3D, atau 4D. Status kena jika **minimal satu digit target** terdapat di output AI.

### BBFS

User memilih target 2D, 3D, atau 4D. Status kena hanya jika **seluruh digit target** terdapat di output BBFS.

## Struktur Halaman

| Route | Fungsi |
| --- | --- |
| `/` | Scan utama untuk satu pasaran |
| `/movement` | Movement Engine: Posisi, AI, dan BBFS |
| `/batch` | Batch Scan untuk banyak pasaran |
| `/admin` | Pengelolaan PIN dan akses device |
| `/manifest.webmanifest` | Manifest PWA |
| `/sw.js` | Service worker PWA |

## Struktur API

| API | Method | Fungsi |
| --- | --- | --- |
| `/api/markets` | GET | Mengambil daftar pasaran |
| `/api/scan` | POST | Scan satu pasaran |
| `/api/movement` | POST | Analisa pergerakan dan membentuk output |
| `/api/batch-scan` | POST | Scan banyak pasaran sekaligus |
| `/api/saved-trek` | POST | Refresh trek tersimpan |

## Cara Pakai Movement

1. Buka menu **Prediksi**.
2. Pilih pasaran.
3. Pilih jenis output: Posisi, AI, atau BBFS.
4. Pilih target.
5. Pilih jumlah digit.
6. Tekan **Jalankan Analisa**.
7. Lihat rekomendasi, evaluasi, ranking digit, dan riwayat uji.
8. Tekan **Salin Hasil**.

## Batch Scan

Batch Scan tetap menggunakan engine scan rumus. Batas aman saat ini adalah 35 pasaran per proses batch.
