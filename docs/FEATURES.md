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
- Walk-forward tetap pada 14 result terbaru.
- Window training kelipatan 14.
- Turnamen seluruh metode × window.
- Joint Pair 00–99 untuk target 2D.
- Release gate terhadap baseline.
- Ranking probabilitas digit untuk rekomendasi yang lolos.
- Output ringkas dan siap copy.
- PWA installable.
- Data pasaran dibaca dari Supabase melalui server.

## Movement Engine

Movement Engine menguji metode berikut:

- Delta;
- Motif;
- Cycle;
- Cross-position;
- Joint Pair untuk target 2D.

Empat belas result terbaru selalu dijadikan data uji walk-forward. Data sebelum target menjadi training dan diambil menggunakan window kelipatan 14.

Dengan 168 result, window yang diuji:

```txt
W14, W28, W42, W56, W70, W84,
W98, W112, W126, W140, W154
```

Setiap metode diuji pada seluruh window tersebut. Pemenang dipilih berdasarkan L14, L7, miss streak, L3, dan stabilitas window tetangga. Metode pemenang kemudian dilatih ulang memakai window terbaru untuk membentuk prediksi berikutnya.

Rekomendasi tidak diterbitkan jika kemenangan pemenang belum melewati batas baseline.

### Posisi

User memilih AS, COP, KPL, atau EKR. Status kena jika digit posisi berikutnya terdapat di output.

### AI

User memilih target 2D, 3D, atau 4D. Status kena jika **minimal satu digit target** terdapat di output AI.

### BBFS

User memilih target 2D, 3D, atau 4D. Status kena hanya jika **seluruh digit target** terdapat di output BBFS.

Untuk BBFS 2D, metode Joint Pair menilai pasangan 00–99 secara langsung.

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
| `/api/movement` | POST | Menjalankan turnamen L14 dan membentuk output |
| `/api/batch-scan` | POST | Scan banyak pasaran sekaligus |
| `/api/saved-trek` | POST | Refresh trek tersimpan |

## Cara Pakai Movement

1. Buka menu **Prediksi**.
2. Pilih pasaran.
3. Pilih jenis output: Posisi, AI, atau BBFS.
4. Pilih target.
5. Pilih jumlah digit.
6. Tekan **Jalankan Analisa**.
7. Lihat pemenang metode × window dan riwayat uji L14.
8. Jika lolos baseline, salin rekomendasi yang diterbitkan.

## Batch Scan

Batch Scan tetap menggunakan engine scan rumus. Batas aman saat ini adalah 35 pasaran per proses batch.
