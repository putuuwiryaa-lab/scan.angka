# Deployment

Dokumen ini berisi environment variables, instalasi lokal, build production, deploy Vercel, dan PWA.

## Environment Variables

Tambahkan environment variable berikut di Vercel:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
APP_ACCESS_PIN
APP_AUTH_SECRET
```

Keterangan:

- `APP_ACCESS_PIN`: PIN akses 8 digit.
- `APP_AUTH_SECRET`: secret panjang untuk tanda tangan cookie akses. Ganti nilai ini untuk memutus semua sesi lama.

Contoh `.env.local`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
APP_ACCESS_PIN=12345678
APP_AUTH_SECRET=random-secret-panjang
```

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

## Build Production

Jalankan build:

```bash
npm run build
```

Jalankan production server:

```bash
npm run start
```

## Deploy ke Vercel

1. Login ke Vercel.
2. Import repository dari GitHub.
3. Tambahkan environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `APP_ACCESS_PIN`
   - `APP_AUTH_SECRET`
4. Deploy.
5. Setelah deploy selesai, buka domain Vercel atau custom domain.

## Catatan Limit Vercel Free

Jika Vercel menampilkan error seperti ini:

```txt
Resource is limited - try again in 24 hours
code: api-deployments-free-per-day
```

Artinya limit deploy harian akun Free sudah tercapai. Tunggu limit reset atau kurangi commit/deploy kecil yang tidak perlu.

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

- Bisa dipasang ke layar utama HP.
- Nama aplikasi: Scan Angka.
- Mode standalone.
- Icon aplikasi tersedia.
- Basic cache dengan service worker.

Cara install di Chrome Android:

1. Buka website Scan Angka.
2. Tekan menu titik tiga di Chrome.
3. Pilih **Tambahkan ke layar utama** atau **Install app**.
4. Buka dari ikon yang muncul di layar utama.
