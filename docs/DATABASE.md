# Database Supabase

Aplikasi membaca data pasaran dari Supabase dan memakai sistem akses PIN 1x pakai.

## Tabel Pasaran

```sql
markets
```

## Kolom Pasaran Yang Digunakan

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

## Sistem Akses PIN

Sistem akses memakai 2 tabel:

```txt
access_pins
access_sessions
```

Alur:

```txt
Admin generate PIN di /admin
User input PIN di /pin
PIN berubah dari unused menjadi used
Session permanen dibuat di access_sessions
Admin bisa hapus akses dengan revoke session
```

PIN asli tidak disimpan di database. Server hanya menyimpan `pin_hash`.

Session token asli juga tidak disimpan di database. Cookie user menyimpan token asli, database hanya menyimpan `session_token_hash`.

## Status PIN

```txt
unused  = belum dipakai
used    = sudah dipakai
revoked = dibatalkan admin
```

## Status Session

```txt
revoked_at null    = akses aktif
revoked_at terisi  = akses sudah dihapus admin
```

## View Admin

Admin dashboard memakai view:

```txt
admin_access_pins_view
admin_access_sessions_view
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ACCESS_SECRET=
ADMIN_PASSWORD=
```

Catatan:

- `ACCESS_SECRET` dipakai untuk hash PIN, hash session, hash IP, dan admin session.
- `ADMIN_PASSWORD` dipakai untuk login `/admin`.
- `SUPABASE_SERVICE_ROLE_KEY` hanya boleh dipakai di server.
