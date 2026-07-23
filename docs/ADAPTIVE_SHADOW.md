# Adaptive Shadow Predictions

Tahap 2 mencatat prediksi live seluruh kandidat metode × window tanpa mengubah kandidat yang dipublikasikan kepada pengguna.

Untuk setiap prediksi induk pada `adaptive_predictions`, tabel `adaptive_prediction_candidates` menyimpan:

- ranking awal L14;
- metode dan window;
- digit live kandidat;
- probabilitas digit;
- selection score, runner-up score, dan margin;
- hit L14, L7, dan L3;
- mean probability;
- penanda kandidat yang benar-benar dipilih;
- hasil live `is_hit` setelah result berikutnya tersedia.

Jumlah shadow candidate untuk histori 168 result:

```txt
Posisi / 3D / 4D = 99 kandidat
Target 2D        = 110 kandidat
```

Semua kandidat dinilai terhadap result aktual yang sama dengan prediksi induknya. Kandidat shadow tidak ditampilkan sebagai output pengguna dan belum memengaruhi pemilihan model.

## Pemeriksaan SQL

Jumlah kandidat per prediksi:

```sql
select
  p.market_id,
  p.created_at,
  p.output_type,
  p.target,
  p.digit_count,
  count(c.id) as shadow_candidates
from public.adaptive_predictions p
join public.adaptive_prediction_candidates c on c.prediction_id = p.id
group by p.id
order by p.created_at desc;
```

Performa live metode × window:

```sql
select
  p.market_id,
  p.output_type,
  p.target,
  p.digit_count,
  c.method,
  c."window",
  count(*) filter (where c.is_hit is not null) as settled,
  count(*) filter (where c.is_hit = true) as hit,
  count(*) filter (where c.is_hit = false) as miss,
  round(
    100.0 * count(*) filter (where c.is_hit = true)
    / nullif(count(*) filter (where c.is_hit is not null), 0),
    2
  ) as hit_rate
from public.adaptive_prediction_candidates c
join public.adaptive_predictions p on p.id = c.prediction_id
where p.status = 'settled'
group by p.market_id, p.output_type, p.target, p.digit_count, c.method, c."window"
order by settled desc, hit_rate desc nulls last;
```

Kandidat terpilih dibanding kandidat shadow pada result yang sama:

```sql
select
  p.market_id,
  p.source_result,
  p.actual_result,
  p.selected_method,
  p.selected_window,
  p.is_hit as published_hit,
  c.initial_rank,
  c.method,
  c."window",
  c.selected_digits,
  c.is_hit as shadow_hit
from public.adaptive_predictions p
join public.adaptive_prediction_candidates c on c.prediction_id = p.id
where p.status = 'settled'
order by p.settled_at desc, c.initial_rank asc;
```