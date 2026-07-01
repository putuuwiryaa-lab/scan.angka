# Troubleshooting

Dokumen ini berisi masalah umum dan langkah pengecekan.

## Preview WhatsApp masih menampilkan teks lama

WhatsApp sering menyimpan cache preview link. Setelah metadata diganti dan Vercel redeploy, preview bisa tetap lama untuk sementara.

Solusi:

- Coba kirim link di chat lain.
- Tunggu cache WhatsApp berubah.
- Pastikan deploy terbaru sudah aktif.

## Data pasaran tidak muncul

Cek hal berikut:

- Environment variable Supabase sudah benar.
- Tabel `markets` ada.
- Policy public read sudah aktif.
- Kolom `history_data` tidak kosong.

## Hasil scan kosong atau tanda `-`

Kemungkinan:

- Data `history_data` kurang panjang.
- Format data tidak 4 digit.
- Data Uji terlalu besar.
- Tidak ada rumus yang lolos pada parameter tersebut.

## PWA tidak muncul tombol install

Kemungkinan:

- Website belum HTTPS.
- Service worker belum aktif.
- Browser masih cache versi lama.
- Manifest belum terbaca setelah deploy.

Solusi:

- Redeploy Vercel.
- Clear cache browser.
- Buka ulang website.

## Build error: export tidak ditemukan

Contoh error:

```txt
Export isShioMode doesn't exist in target module
```

Penyebab umum:

- Fungsi sudah dipindah dari satu file ke file shared.
- Masih ada import lama dari file yang tidak lagi melakukan re-export.

Solusi:

- Cari import lama.
- Import fungsi langsung dari sumber canonical.
- Untuk helper mode scan, gunakan `app/shared/scan-utils` di UI atau `lib/shared/scan-mode` di engine.

## Limit deploy Vercel Free

Jika muncul pesan:

```txt
Resource is limited - try again in 24 hours
code: api-deployments-free-per-day
```

Artinya limit deploy harian sudah tercapai. Tunggu 24 jam atau kurangi frekuensi deploy.
