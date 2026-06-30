# Scan Angka

Scan Angka adalah aplikasi web untuk membaca riwayat data angka, menjalankan proses scan berdasarkan data uji, lalu menampilkan output per pasaran maupun banyak pasaran sekaligus melalui fitur Batch Scan.

Aplikasi ini dibuat dengan Next.js, TypeScript, Supabase, dan Vercel. Tampilan dibuat ringan untuk penggunaan dari HP, dengan dukungan PWA agar bisa dipasang ke layar utama seperti aplikasi.

---

## Ringkasan Fitur

- Scan satu pasaran
- Batch Scan banyak pasaran sekaligus
- Pilihan jenis trek:
  - As
  - Cop
  - Kepala
  - Ekor
  - AI 2D Belakang
  - BBFS 2D Belakang
- Pilihan jumlah digit 1 sampai 9
- Pilihan Data Uji
- Batas jumlah hasil scan
- Output ringkas dan siap copy
- Detail hasil scan per rumus
- Frekuensi digit dari hasil scan
- PWA installable
- Data pasaran dibaca dari Supabase

---

## Keunggulan Utama

Fitur pembeda utama aplikasi ini adalah Batch Scan.

Dengan Batch Scan, pengguna tidak perlu scan pasaran satu per satu. Pengguna cukup memilih banyak pasaran, menentukan jenis scan, jumlah digit, dan Data Uji, lalu sistem menampilkan hasil seluruh pasaran dalam satu output yang rapi dan siap copy.

---

## Struktur Halaman

| Route | Fungsi |
| --- | --- |
| `/` | Halaman scan utama untuk satu pasaran |
| `/batch` | Halaman Batch Scan untuk banyak pasaran |
| `/manifest.webmanifest` | Manifest PWA |
| `/sw.js` | Service worker PWA |

---

## Struktur API

| API | Method | Fungsi |
| --- | --- | --- |
| `/api/markets` | GET | Mengambil daftar pasaran dari Supabase |
| `/api/scan` | POST | Scan satu pasaran |
| `/api/batch-scan` | POST | Scan banyak pasaran sekaligus |

---

## Cara Pakai Aplikasi

### Scan Satu Pasaran

1. Buka halaman utama.
2. Pilih pasaran.
3. Atur Data Uji.
4. Pilih Jenis Trek.
5. Pilih Jumlah Digit Trek.
6. Atur Batas Hasil.
7. Tekan **Scan Sekarang**.
8. Tekan **Lihat** untuk membuka detail rumus dan riwayat scan.

### Batch Scan

1. Buka halaman utama.
2. Tekan tombol **Batch Scan** di bawah form utama.
3. Pilih Data Uji.
4. Pilih Jenis Trek.
5. Pilih Jumlah Digit.
6. Pilih satu atau banyak pasaran.
7. Tekan **Batch Scan**.
8. Copy output yang muncul.

---

## Cara Kerja Singkat

1. Sistem membaca riwayat data angka dari kolom `history_data`.
2. Data diproses dari urutan lama ke baru.
3. Sistem menjalankan daftar rumus scan.
4. Rumus diuji menggunakan Data Uji yang dipilih.
5. Rumus yang lolos diproses ke ranking.
6. Output digit ditampilkan sesuai jumlah digit yang dipilih.
7. Untuk Batch Scan, proses yang sama dijalankan ke banyak pasaran sekaligus.

---

## Logic Ranking Engine

Engine memakai beberapa lapisan ranking agar hasil tidak sekadar mengambil rumus pertama yang lolos.

Urutan ranking utama:

1. Compression Ranking
2. Consensus Representative Ranking
3. Recent Score
4. Hit Score
5. Type Order
6. Urutan posisi dan rumus

### Compression Ranking

Rumus yang lolos pada jumlah digit pilihan akan diuji apakah masih bisa dipadatkan ke core yang lebih kecil.

Contoh:

```txt
User pilih 7D
Engine cek 7D
Lalu dicek apakah bisa tetap lolos di 6D atau 5D
```

Jika ada rumus yang tetap kuat saat dipadatkan, rumus tersebut akan diprioritaskan.

### Support Column Selection

Jika core lebih kecil dari jumlah digit display, sistem menambahkan support dari rumus yang sama.

Support tidak dipilih asal urutan A-J, tetapi berdasarkan alasan:

1. Menjembatani dua core kuat
2. Menempel ke core kuat
3. Punya hit sendiri pada rumus tersebut
4. Jika masih sama, memakai cadangan kolom yang tersedia

Metadata support yang tersedia di item scan:

```txt
coreSize
coreColumns
supportColumns
supportReasons
```

### Consensus Representative Ranking

Jika beberapa rumus setara dan tidak ada yang lebih unggul dari sisi compression, sistem membuat frekuensi digit dari kelompok rumus setara.

Contoh:

```txt
User pilih 7D
Engine mengambil top 7 frekuensi dari rumus-rumus yang setara
Lalu memilih rumus yang paling mewakili top 7 tersebut
```

Untuk AI 4D, sistem memakai top 4. Untuk 5D memakai top 5, dan seterusnya.

Metadata consensus yang tersedia:

```txt
consensusDigits
consensusOverlap
consensusWeight
```

---

## Data Supabase

Aplikasi membaca data dari tabel `markets`.

### Nama Tabel

```sql
markets
```

### Kolom Yang Digunakan

```txt
id text
name text
history_data text
order integer
updated_at timestamptz
```

### Contoh Isi `history_data`

```txt
1234 5678 9012 3456
```

Aturan:

- Setiap data harus 4 digit.
- Dipisahkan dengan spasi.
- Data paling kiri adalah data lama.
- Data paling kanan adalah data terbaru.

---

## Contoh Query Supabase

Aktifkan Row Level Security:

```sql
alter table markets enable row level security;
```

Izinkan public read untuk data pasaran:

```sql
create policy "allow public read markets"
on markets for select
to anon
using (true);
```

Contoh insert data:

```sql
insert into markets (id, name, history_data, "order")
values (
  'singapore',
  'Singapore',
  '1234 5678 9012 3456',
  1
);
```

Contoh update data:

```sql
update markets
set history_data = '1234 5678 9012 3456 7890',
    updated_at = now()
where id = 'singapore';
```

---

## Environment Variables

Tambahkan environment variable berikut di Vercel:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Contoh `.env.local`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Instalasi Lokal

Clone repository:

```bash
git clone https://github.com/putuuwiryaa-lab/scan.angka.git
cd scan.angka
```

Install dependency:

```bash
npm install
```

Jalankan mode development:

```bash
npm run dev
```

Buka di browser:

```txt
http://localhost:3000
```

---

## Build Production

Jalankan build:

```bash
npm run build
```

Jalankan production server:

```bash
npm run start
```

---

## Deploy ke Vercel

1. Login ke Vercel.
2. Import repository dari GitHub.
3. Tambahkan environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. Setelah deploy selesai, buka domain Vercel atau custom domain.

---

## PWA

Aplikasi sudah mendukung PWA.

File PWA:

```txt
app/manifest.ts
app/pwa-register.tsx
public/sw.js
public/icon-192.png
public/icon-512.png
public/icon.svg
```

Fitur PWA:

- Bisa dipasang ke layar utama HP
- Nama aplikasi: Scan Angka
- Mode standalone
- Icon aplikasi tersedia
- Basic cache dengan service worker

Cara install di Chrome Android:

1. Buka website Scan Angka.
2. Tekan menu titik tiga di Chrome.
3. Pilih **Tambahkan ke layar utama** atau **Install app**.
4. Buka dari ikon yang muncul di layar utama.

---

## Struktur Folder Penting

```txt
app/
  api/
    batch-scan/
      route.ts
    markets/
      route.ts
    scan/
      route.ts
  batch/
    page.tsx
  globals.css
  layout.tsx
  manifest.ts
  page.tsx
  pwa-register.tsx

lib/
  engine/
    acke-engine.ts
    history.ts
    types.ts
  supabase/
    client.ts

public/
  icon-192.png
  icon-512.png
  icon.svg
  sw.js
```

---

## File Utama

| File | Fungsi |
| --- | --- |
| `app/page.tsx` | Halaman utama scan satu pasaran |
| `app/batch/page.tsx` | Halaman Batch Scan |
| `app/api/scan/route.ts` | API scan satu pasaran |
| `app/api/batch-scan/route.ts` | API batch scan |
| `app/api/markets/route.ts` | API daftar pasaran |
| `lib/engine/acke-engine.ts` | Engine scan dan ranking |
| `lib/engine/history.ts` | Validasi format data riwayat |
| `lib/engine/types.ts` | Tipe data engine |
| `lib/supabase/client.ts` | Client Supabase |
| `app/manifest.ts` | Manifest PWA |
| `public/icon-192.png` | Icon PWA 192x192 |
| `public/icon-512.png` | Icon PWA 512x512 |
| `public/sw.js` | Service worker |

---

## Troubleshooting

### Preview WhatsApp masih menampilkan teks lama

WhatsApp sering menyimpan cache preview link. Setelah metadata diganti dan Vercel redeploy, preview bisa tetap lama untuk sementara.

Solusi:

- Coba kirim link di chat lain.
- Tunggu cache WhatsApp berubah.
- Pastikan deploy terbaru sudah aktif.

### Data pasaran tidak muncul

Cek hal berikut:

- Environment variable Supabase sudah benar.
- Tabel `markets` ada.
- Policy public read sudah aktif.
- Kolom `history_data` tidak kosong.

### Hasil scan kosong atau tanda `-`

Kemungkinan:

- Data `history_data` kurang panjang.
- Format data tidak 4 digit.
- Data Uji terlalu besar.
- Tidak ada rumus yang lolos pada parameter tersebut.

### PWA tidak muncul tombol install

Kemungkinan:

- Website belum HTTPS.
- Service worker belum aktif.
- Browser masih cache versi lama.
- Manifest belum terbaca setelah deploy.

Solusi:

- Redeploy Vercel.
- Clear cache browser.
- Buka ulang website.

---

## Catatan Penggunaan

Scan Angka adalah alat bantu analisa. Output yang ditampilkan berasal dari proses scan terhadap riwayat data dan parameter yang dipilih pengguna. Hasil aplikasi tidak boleh dianggap sebagai jaminan.

---

## Status Pengembangan

Aplikasi masih tahap awal. Fitur akan terus ditambahkan dan dikembangkan secara bertahap.

Rencana pengembangan:

- Penyempurnaan tampilan PWA
- Informasi detail core dan support di UI
- Export output yang lebih fleksibel
- Optimasi performa Batch Scan
- Penambahan mode scan lanjutan

---

## Lisensi

Private project / internal project.