# Scan Angka

Aplikasi web untuk membaca riwayat data angka, menjalankan proses scan, dan menampilkan output per pasaran maupun banyak pasaran sekaligus melalui Batch Scan.

Dibuat dengan Next.js dan Supabase, siap deploy ke Vercel.

---

## Fitur utama

- Scan per pasaran
- Batch Scan banyak pasaran sekaligus
- Pilihan jenis trek: As, Cop, Kepala, Ekor, AI 2D Belakang, BBFS 2D Belakang
- Pilihan jumlah digit
- Output rapi dan siap copy
- Data dibaca dari Supabase

---

## Cara pakai

1. Buka halaman utama untuk scan satu pasaran.
2. Pilih pasaran.
3. Atur Data Uji, Jenis Trek, Jumlah Digit Trek, dan Batas Hasil.
4. Tekan **Scan Sekarang**.
5. Untuk banyak pasaran sekaligus, tekan tombol **Batch Scan** di bawah form utama.

---

## Struktur data Supabase

Tabel utama:

```sql
markets
```

Kolom yang digunakan:

```txt
id text
name text
history_data text
order integer
updated_at timestamptz
```

Format `history_data`:

```txt
1234 5678 9012 3456
```

Kiri = data lama, kanan = data terbaru.

---

## Environment Variables

Tambahkan di Vercel:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
