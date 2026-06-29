# Racik ACKE

Alat analisa kolom mati **As / Cop / Kepala / Ekor** dari data keluaran di Supabase.
Dibuat dengan Next.js, siap deploy ke Vercel.

---

## Cara pakai (untuk pemula, dari HP)

### 1. Pastikan semua file sudah ada di repo

Struktur yang benar:

```
racik-acke/
  package.json
  next.config.mjs
  tsconfig.json
  .gitignore
  .env.local.example
  README.md
  lib/
    engine/
      types.ts
      acke-engine.ts
    supabase/
      client.ts
  app/
    layout.tsx
    page.tsx
    globals.css
    api/
      markets/
        route.ts
      acke/
        route.ts
```

Di GitHub web: **Add file → Create new file**, ketik path lengkap (mis.
`app/api/acke/route.ts`), paste isinya, lalu **Commit**.

### 2. Buka akses baca tabel di Supabase

Di Supabase → **SQL Editor**, jalankan:

```sql
alter table markets enable row level security;

create policy "allow public read markets"
on markets for select to anon using (true);
```

### 3. Ambil kunci Supabase

Supabase → **Project Settings → API**. Catat:

- **Project URL** (mis. `https://xxxx.supabase.co`)
- **anon public** key

### 4. Hubungkan ke Vercel

1. Buka vercel.com, login pakai GitHub.
2. **Add New → Project**, pilih repo `racik-acke`, klik **Import**.
3. Di bagian **Environment Variables**, tambahkan dua:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL tadi
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key tadi
4. Klik **Deploy**. Tunggu selesai, buka URL yang diberikan.

Selesai. Pilih pasaran, atur patokan & target, tekan **Hitung**.

---

## Catatan teknis

- Engine ada di `lib/engine/` — fungsi murni, tanpa I/O, gampang dites.
- Token `[A/C/K/E][N]`: patokan diambil dari hasil N langkah sebelum target
  (N=1 = hasil terbaru).
- `history_data` dibaca apa adanya: angka 4D dipisah spasi, kiri = terlama.
- `Patah` dan `D0` belum dipakai (semua data uji bernilai 0).
