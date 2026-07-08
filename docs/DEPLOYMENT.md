# Deployment

Dokumen ini berisi environment variables, instalasi lokal, build production, deploy Vercel, alur akses PIN, dan PWA.

## Environment Variables

Tambahkan environment variable wajib berikut di Vercel:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ACCESS_SECRET
ADMIN_PASSWORD
```

Keterangan:

- `NEXT_PUBLIC_SUPABASE_URL`: URL Supabase untuk konfigurasi public/client.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key Supabase untuk akses client/public config.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key untuk operasi server seperti aktivasi PIN, generate PIN, validasi session, dan revoke akses. Jangan expose ke client.
- `ACCESS_SECRET`: secret HMAC untuk hash PIN, hash session token, hash IP, dan tanda tangan admin session.
- `ADMIN_PASSWORD`: password untuk login halaman admin `/admin/login`.

Opsional:

```txt
SUPABASE_URL
```

Jika `SUPABASE_URL` tidak diisi, server akan memakai `NEXT_PUBLIC_SUPABASE_URL` sebagai fallback untuk admin Supabase client.

Contoh `.env.local`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ACCESS_SECRET=random-secret-panjang
ADMIN_PASSWORD=password-admin-kuat
```

## Alur Akses User

Login user memakai sistem PIN 8 digit sekali pakai.

```txt
User buka /pin
User input PIN 8 digit
Frontend kirim PIN + device_id + device_name ke /api/pin/activate
Server cek PIN di access_pins
Server membuat session di access_sessions
PIN berubah dari unused menjadi used
Server menyimpan cookie scan_access_token dan scan_device_id
User diarahkan ke halaman utama
```

Cookie user:

```txt
scan_access_token
scan_device_id
```

Catatan:

- PIN asli tidak disimpan di database.
- Database hanya menyimpan `pin_hash`.
- Session token asli tidak disimpan di database.
- Database hanya menyimpan `session_token_hash`.
- Akses user terikat ke `device_id` yang dibuat di browser.

## Alur Admin

Admin login melalui:

```txt
/admin/login
```

Admin memakai `ADMIN_PASSWORD`. Jika login berhasil, server membuat cookie:

```txt
scan_admin_session
```

Halaman admin:

```txt
/admin
```

Fungsi admin:

- Membuat PIN akses baru.
- Melihat riwayat PIN.
- Melihat session/device aktif.
- Menghapus akses device.
- Membatalkan PIN yang belum dipakai.

## Tabel dan View Supabase

Tabel akses:

```txt
access_pins
access_sessions
```

View admin:

```txt
admin_access_pins_view
admin_access_sessions_view
```

Kolom utama `access_pins`:

```txt
id
pin_hash
status
note
created_at
used_at
revoked_at
used_session_id
```

Status PIN:

```txt
unused  = belum dipakai
used    = sudah dipakai
revoked = dibatalkan admin
```

Kolom utama `access_sessions`:

```txt
id
pin_id
session_token_hash
device_id
device_name
user_agent
ip_hash
created_at
last_seen_at
revoked_at
revoked_reason
```

Session aktif jika `revoked_at` masih `null`.

## Route Akses

Route publik:

```txt
/pin
/admin/login
/api/pin/activate
/api/admin/login
/manifest.webmanifest
/sw.js
asset static
```

Route user yang membutuhkan akses aktif:

```txt
/
/batch
/api/markets
/api/scan
/api/batch-scan
/api/saved-trek
```

Route admin yang membutuhkan session admin:

```txt
/admin
/api/admin/pins
/api/admin/sessions
/api/admin/sessions/[id]/revoke
/api/admin/pins/[id]/revoke
/api/admin/logout
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

Jalankan typecheck:

```bash
npm run typecheck
```

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
3. Tambahkan environment variables Supabase dan akses PIN.
4. Pastikan tabel `access_pins` dan `access_sessions` sudah dibuat di Supabase.
5. Pastikan view `admin_access_pins_view` dan `admin_access_sessions_view` sudah tersedia.
6. Deploy.
7. Setelah deploy selesai, buka domain Vercel atau custom domain.
8. Login admin melalui `/admin/login`.
9. Generate PIN dari `/admin`.
10. User login melalui `/pin` memakai PIN yang dibuat admin.

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
