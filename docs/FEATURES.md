# Fitur Scan Angka

Dokumen ini merangkum fitur aplikasi, struktur halaman/API, dan cara pakai dasar.

## Ringkasan Fitur

- Scan satu pasaran.
- Batch Scan banyak pasaran sekaligus.
- Trek tersimpan lintas pasaran.
- Pilihan jenis scan:
  - Trek Posisi
  - AI 2D
  - BBFS 2D
  - Jumlah 2D
  - Shio
  - OFF Posisi
  - OFF 2D
  - OFF Jumlah 2D
  - OFF Shio
- Pilihan jumlah digit 1 sampai 9.
- Pilihan jumlah shio 1 sampai 12.
- Pilihan Data Uji.
- Batas jumlah hasil scan.
- Output ringkas dan siap copy.
- Detail hasil scan per rumus.
- Frekuensi digit dari hasil scan.
- PWA installable.
- Data pasaran dibaca dari Supabase.

## Keunggulan Utama

Fitur pembeda utama aplikasi ini adalah **Batch Scan**.

Dengan Batch Scan, pengguna tidak perlu scan pasaran satu per satu. Pengguna cukup memilih banyak pasaran, menentukan jenis scan, jumlah digit, dan Data Uji, lalu sistem menampilkan hasil seluruh pasaran dalam satu output yang rapi dan siap copy.

Batas aman Batch Scan saat ini adalah **35 pasaran per proses batch**.

## Struktur Halaman

| Route | Fungsi |
| --- | --- |
| `/` | Halaman scan utama untuk satu pasaran |
| `/batch` | Halaman Batch Scan untuk banyak pasaran |
| `/manifest.webmanifest` | Manifest PWA |
| `/sw.js` | Service worker PWA |

## Struktur API

| API | Method | Fungsi |
| --- | --- | --- |
| `/api/markets` | GET | Mengambil daftar pasaran dari Supabase |
| `/api/scan` | POST | Scan satu pasaran |
| `/api/batch-scan` | POST | Scan banyak pasaran sekaligus |
| `/api/saved-trek` | POST | Refresh trek tersimpan berdasarkan market asal |

## Cara Pakai Aplikasi

### Scan Satu Pasaran

1. Buka halaman utama.
2. Pilih pasaran.
3. Atur Data Uji.
4. Pilih Jenis Trek.
5. Pilih Jumlah Digit/Shio.
6. Atur Batas Hasil.
7. Tekan **Scan Sekarang**.
8. Tekan **Simpan** untuk menyimpan trek.
9. Tekan **Lihat** untuk membuka detail rumus dan riwayat scan.

### Trek Tersimpan

Trek tersimpan tidak terikat dengan pasaran yang sedang dibuka. Semua trek tersimpan akan tampil lintas market dan tetap dikelompokkan berdasarkan pasaran asal, jenis scan, target, jumlah digit, dan Data Uji.

### Batch Scan

1. Buka halaman **Batch Scan**.
2. Pilih Data Uji.
3. Pilih Jenis Trek.
4. Pilih Jumlah Digit/Shio.
5. Pilih satu atau banyak pasaran.
6. Tekan **Batch Scan**.
7. Copy output yang muncul.
