# Database Supabase

Aplikasi membaca data pasaran dari Supabase dan sekarang memakai akun Telegram yang sama dengan Analisa Angka.

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

## Tabel Login Telegram Bersama

Scan Angka memakai tabel login utama dari Analisa Angka:

```txt
telegram_users
telegram_login_codes
telegram_access_events
```

Bot Telegram tetap satu dan webhook tetap diarahkan ke aplikasi Analisa Angka. Scan Angka hanya membaca dan mengonsumsi kode login dari tabel `telegram_login_codes`.

## Tabel Session Khusus Scan Angka

Agar login Scan Angka tidak menimpa session aktif di Analisa Angka, Scan Angka memakai session aplikasi terpisah:

```sql
create table if not exists public.telegram_app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.telegram_users(id) on delete cascade,
  telegram_user_id bigint,
  app_key text not null,
  session_id text not null,
  device_hash text,
  user_agent_hash text,
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_key)
);

create index if not exists telegram_app_sessions_user_idx
on public.telegram_app_sessions (user_id, app_key);

create index if not exists telegram_app_sessions_session_idx
on public.telegram_app_sessions (session_id);
```

Nilai `app_key` untuk aplikasi ini:

```txt
scan
```

## Catatan RLS

Aplikasi front-end memakai anon key untuk data pasaran. Untuk kebutuhan public read, cukup buka policy `select` ke role `anon` pada tabel `markets`. Hindari policy insert/update/delete public kecuali memang dibutuhkan dan sudah diproteksi.

Route login Telegram dan validasi session memakai `SUPABASE_SERVICE_ROLE_KEY` di server, jadi service role tidak boleh diexpose ke client.
