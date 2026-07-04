# Deployment

Dokumen ini berisi environment variables, instalasi lokal, build production, deploy Vercel, dan PWA.

## Environment Variables

Tambahkan environment variable berikut di Vercel:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_LOGIN_CODE_SECRET
TOKEN_VERSION
SUPER_USER_PIN
```

Keterangan:

- `NEXT_PUBLIC_SUPABASE_URL`: URL Supabase untuk client/public config.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key Supabase untuk membaca data pasaran.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key untuk validasi login Telegram di server. Jangan expose ke client.
- `JWT_SECRET`: secret tanda tangan JWT. Samakan dengan Analisa Angka.
- `TELEGRAM_WEBHOOK_SECRET`: fallback secret hashing kode login. Samakan dengan Analisa Angka.
- `TELEGRAM_LOGIN_CODE_SECRET`: secret khusus hashing kode login. Samakan dengan Analisa Angka jika dipakai.
- `TOKEN_VERSION`: versi token. Samakan dengan Analisa Angka. Default `2`.
- `SUPER_USER_PIN`: opsional, kode super 6 digit untuk akses darurat.

Contoh `.env.local`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=random-secret-panjang-sama-dengan-analisa
TELEGRAM_WEBHOOK_SECRET=telegram-webhook-secret-sama-dengan-analisa
TELEGRAM_LOGIN_CODE_SECRET=telegram-login-code-secret-sama-dengan-analisa
TOKEN_VERSION=2
SUPER_USER_PIN=123456
```

> Sistem PIN lama (`APP_ACCESS_PIN` dan `APP_AUTH_SECRET`) tidak dipakai lagi untuk akses utama. Login utama memakai kode Telegram dari bot Analisa Angka.

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
3. Tambahkan environment variables Telegram/Supabase di atas.
4. Pastikan tabel `telegram_app_sessions` sudah dibuat di Supabase.
5. Deploy.
6. Setelah deploy selesai, buka domain Vercel atau custom domain.
7. Login memakai kode dari bot Telegram yang sama dengan Analisa Angka.

## Setup Bot Telegram

Bot Telegram tetap satu. Webhook tetap diarahkan ke aplikasi Analisa Angka, bukan ke Scan Angka.

```txt
Bot Telegram → /api/telegram/webhook di Analisa Angka
Scan Angka → hanya memakai /api/code-login untuk membaca kode dari database yang sama
```

Jangan set webhook bot ke Scan Angka karena Telegram hanya memakai satu webhook aktif per bot.

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
