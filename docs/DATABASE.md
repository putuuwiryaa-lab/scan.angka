# Database Supabase

Aplikasi membaca data pasaran dari Supabase.

## Nama Tabel

```sql
markets
```

## Kolom Yang Digunakan

```txt
id text
name text
history_data text
order integer
updated_at timestamptz
```

## Contoh Isi `history_data`

```txt
1234 5678 9012 3456
```

Aturan:

- Setiap data harus 4 digit.
- Dipisahkan dengan spasi.
- Data paling kiri adalah data lama.
- Data paling kanan adalah data terbaru.

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

## Catatan RLS

Aplikasi front-end memakai anon key. Untuk kebutuhan public read, cukup buka policy `select` ke role `anon`. Hindari policy insert/update/delete public kecuali memang dibutuhkan dan sudah diproteksi.
