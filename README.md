# Racik ACKE

Alat analisa kolom mati **As / Cop / Kepala / Ekor** dari data keluaran di Supabase.
Dibuat dengan Next.js, siap deploy ke Vercel.

---

## Fitur

- Ambil data pasaran dari tabel `markets` Supabase.
- Baca `history_data` berisi result 4D, kiri = terlama, kanan = terbaru.
- Pilih pasaran.
- Pilih target: `A`, `C`, `K`, atau `E`.
- Pilih patokan: `A1-A9`, `C1-C9`, `K1-K9`, `E1-E9`.
- Atur putaran audit 1 sampai 100, default 15.
- Hitung kolom A-J yang kena dan kolom kosong/mati.
- Generate kode rumus seperti `#SGP_k_A3_L15-P0-D0_ABCDEFGHJ`.

---

## Struktur data Supabase

Tabel yang dipakai:

```txt
public.markets
```

Kolom minimal:

```txt
id           text
name         text
history_data text
order        integer
updated_at   timestamptz
```

`history_data` format:

```txt
1234 5678 9012 3456
```

Kiri = data terlama. Kanan = data terbaru.

---

## SQL akses baca tabel

Jalankan di Supabase SQL Editor:

```sql
alter table public.markets enable row level security;

create policy "allow public read markets"
on public.markets for select to anon using (true);
```

---

## Environment Variables

Di Vercel → Project → Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Jangan commit `.env.local` yang berisi key asli.

---

## Cara deploy ke Vercel

1. Buka Vercel.
2. Add New → Project.
3. Pilih repo `scan.angka`.
4. Tambahkan environment variables.
5. Deploy.

---

## Catatan teknis

- Engine ada di `lib/engine/`.
- Token `[A/C/K/E][N]`: patokan diambil dari hasil N langkah sebelum target.
- Untuk prediksi berikutnya, `A1` memakai result terbaru sebagai H-1.
- `Patah` dan `D0` belum dipakai, output default `P0-D0`.
